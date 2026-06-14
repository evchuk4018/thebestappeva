import assert from 'node:assert/strict';
import test from 'node:test';
import { parseToolInvocation, parseTraceStep } from './ai-trace-contract';

test('parses an answered ask-user trace step', () => {
  const step = parseTraceStep(
    {
      id: 'trace-1',
      kind: 'ask-user',
      toolCallId: 'trace-tool',
      question: 'What would help most?',
      choices: [{ id: 'code', label: 'Coding help', description: 'Debug an issue' }],
      allowOpenEnded: true,
      openEndedPlaceholder: 'Type your answer',
      placement: 'inline_trace',
      required: false,
      status: 'answered',
      response: {
        kind: 'choice',
        choiceId: 'code',
        label: 'Coding help',
        description: 'Debug an issue',
      },
      createdAt: '2026-06-09T00:00:00.000Z',
    },
    'trace',
  );

  assert.equal(step.kind, 'ask-user');
  assert.equal(step.status, 'answered');
  assert.equal(step.response?.kind, 'choice');
  assert.equal(step.response?.label, 'Coding help');
});

test('rejects invalid ask-user placement', () => {
  assert.throws(
    () =>
      parseTraceStep(
        {
          id: 'trace-1',
          kind: 'ask-user',
          toolCallId: 'trace-tool',
          question: 'Bad placement?',
          choices: [{ id: 'yes', label: 'Yes' }],
          allowOpenEnded: true,
          placement: 'middle',
          required: false,
          status: 'pending',
          createdAt: '2026-06-09T00:00:00.000Z',
        },
        'trace',
      ),
    /placement/i,
  );
});

test('parses tool invocations with optional display args', () => {
  const invocation = parseToolInvocation(
    {
      toolId: 'python.exec',
      functionName: 'python_exec',
      args: { code: 'print("secret")', files: ['README.md'] },
      displayArgs: { code: '[Private Python code hidden. Use View Python.]', files: ['README.md'] },
      createdAt: '2026-06-13T00:00:00.000Z',
      toolCallId: 'tool-1',
    },
    'invocation',
  );

  assert.equal(invocation.toolId, 'python.exec');
  assert.equal(invocation.functionName, 'python_exec');
  assert.equal(invocation.args.code, 'print("secret")');
  assert.equal(invocation.displayArgs?.code, '[Private Python code hidden. Use View Python.]');
});
