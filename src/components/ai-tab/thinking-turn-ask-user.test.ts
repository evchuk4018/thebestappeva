import assert from 'node:assert/strict';
import test from 'node:test';
import { appendMessage, createAskUserTraceStep, createAssistantMessage, createNewChat, createUserMessage } from './helpers';
import { ASK_USER_TOOL_ID, updateAskUserStepInChat } from './ask-user';
import { askUserTool } from './tools/ask-user-tool';
import { resolveThinkingTurn } from './thinking-turn';

const originalFetch = globalThis.fetch;

function createStreamResponse(lines: string[]) {
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(`${line}\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}

function createThinkingEvent(delta: string, snapshot: string, model = 'qwen') {
  return JSON.stringify({ type: 'thinking', delta, snapshot, model });
}

function createContentEvent(delta: string, snapshot: string, model = 'qwen') {
  return JSON.stringify({ type: 'content', delta, snapshot, model });
}

function createToolCallsEvent(toolCalls: Array<{ id: string; function: { name: string; arguments: Record<string, unknown> } }>, model = 'qwen') {
  return JSON.stringify({ type: 'tool-calls', toolCalls, model });
}

function createDoneEvent(model = 'qwen') {
  return JSON.stringify({ type: 'done', model });
}

function resolveToolId() {
  return ASK_USER_TOOL_ID;
}

function buildPromptContext() {
  return {
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'thinking' as const,
    tools: [askUserTool.definition],
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('pauses on inline ask_user and resumes the same assistant message after a choice answer', async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return requestCount === 1
      ? createStreamResponse([
          createThinkingEvent('Need one clarification.', 'Need one clarification.'),
          createToolCallsEvent([
            {
              id: 'tool-1',
              function: {
                name: 'ask_user',
                arguments: {
                  question: 'What would help most?',
                  choices: [
                    { id: 'code', label: 'Coding help' },
                    { id: 'research', label: 'Research' },
                  ],
                },
              },
            },
          ]),
          createDoneEvent(),
        ])
      : createStreamResponse([
          createContentEvent('Final answer after the follow-up.', 'Final answer after the follow-up.'),
          createDoneEvent(),
        ]);
  };

  const initial = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Help me decide.'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [askUserTool],
    onProgress: () => {},
    promptContext: buildPromptContext(),
    resolveToolId,
  });

  assert.equal(initial.status, 'paused');
  const pausedAssistant = initial.chat.messages.at(-1);
  assert(pausedAssistant && pausedAssistant.kind === 'assistant');
  assert.deepEqual(pausedAssistant.trace?.map((step) => step.kind), ['thinking', 'tool-call', 'ask-user']);

  const resumedChat = updateAskUserStepInChat(
    initial.chat,
    initial.pendingAskUser.assistantMessageId,
    initial.pendingAskUser.stepId,
    { kind: 'choice', choiceId: 'research', label: 'Research' },
  );
  const resumed = await resolveThinkingTurn({
    assistantMessageId: initial.pendingAskUser.assistantMessageId,
    chat: resumedChat,
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [askUserTool],
    onProgress: () => {},
    promptContext: buildPromptContext(),
    resolveToolId,
  });

  const resumedAssistant = resumed.chat.messages.at(-1);
  assert.equal(requestCount, 2);
  assert.equal(resumed.status, 'completed');
  assert(resumedAssistant && resumedAssistant.kind === 'assistant');
  assert.equal(resumedAssistant.id, initial.pendingAskUser.assistantMessageId);
  assert.equal(resumedAssistant.content, 'Final answer after the follow-up.');
  assert.equal(resumedAssistant.trace?.[2]?.kind === 'ask-user' ? resumedAssistant.trace[2].status : '', 'answered');
});

test('keeps end-of-response content visible while ask_user is pending', async () => {
  globalThis.fetch = async () =>
    createStreamResponse([
      createContentEvent(
        'I can tailor this better once you choose a direction.',
        'I can tailor this better once you choose a direction.',
      ),
      createToolCallsEvent([
        {
          id: 'tool-1',
          function: {
            name: 'ask_user',
            arguments: {
              question: 'Which direction should I take?',
              placement: 'end_of_response',
              choices: [{ id: 'write', label: 'Writing' }],
            },
          },
        },
      ]),
      createDoneEvent(),
    ]);

  const result = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Continue.'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [askUserTool],
    onProgress: () => {},
    promptContext: buildPromptContext(),
    resolveToolId,
  });

  const assistant = result.chat.messages.at(-1);
  assert.equal(result.status, 'paused');
  assert(assistant && assistant.kind === 'assistant');
  assert.equal(assistant.content, 'I can tailor this better once you choose a direction.');
  assert.equal(assistant.trace?.[1]?.kind === 'ask-user' ? assistant.trace[1].placement : '', 'end_of_response');
});

test('auto-skips ask_user after two skips in the same turn history', async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return requestCount === 1
      ? createStreamResponse([
          createToolCallsEvent([
            {
              id: 'tool-1',
              function: {
                name: 'ask_user',
                arguments: {
                  question: 'One more question?',
                  choices: [{ id: 'yes', label: 'Yes' }],
                },
              },
            },
          ]),
          createDoneEvent(),
        ])
      : createStreamResponse([
          createContentEvent('Continuing without another prompt.', 'Continuing without another prompt.'),
          createDoneEvent(),
        ]);
  };

  const firstUser = createUserMessage('Start.');
  const priorAssistant = createAssistantMessage('Prior prompt history', 'qwen', {
    trace: [
      createAskUserTraceStep({
        toolCallId: 'tool-1',
        question: 'Skip one?',
        choices: [{ id: 'a', label: 'A' }],
        allowOpenEnded: true,
        placement: 'inline_trace',
        required: false,
        status: 'skipped',
        response: { kind: 'skip' },
        createdAt: firstUser.createdAt,
      }),
      createAskUserTraceStep({
        toolCallId: 'tool-2',
        question: 'Skip two?',
        choices: [{ id: 'b', label: 'B' }],
        allowOpenEnded: true,
        placement: 'inline_trace',
        required: false,
        status: 'skipped',
        response: { kind: 'skip' },
        createdAt: firstUser.createdAt,
      }),
    ],
  });
  const chat = appendMessage(appendMessage(createNewChat(firstUser, 'thinking'), priorAssistant), createUserMessage('Keep going.'));

  const result = await resolveThinkingTurn({
    chat,
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [askUserTool],
    onProgress: () => {},
    promptContext: buildPromptContext(),
    resolveToolId,
  });

  const assistant = result.chat.messages.at(-1);
  assert.equal(requestCount, 2);
  assert.equal(result.status, 'completed');
  assert(assistant && assistant.kind === 'assistant');
  assert.equal(assistant.trace?.[1]?.kind, 'tool-result');
  assert.match(assistant.trace?.[1]?.kind === 'tool-result' ? assistant.trace[1].result.summary : '', /skipped twice/i);
});
