import assert from 'node:assert/strict';
import test from 'node:test';
import { skillTool } from './skill-tool';
import type { ToolExecutionOutcome, ToolExecutionResult } from './types';

function createInvocation(functionName: string, args: Record<string, unknown> = {}) {
  return {
    toolId: 'skill',
    functionName,
    args,
    createdAt: '2026-06-19T00:00:00.000Z',
  };
}

function skillPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'skill-1',
    name: 'skill-creator',
    description: 'Create reusable skills.',
    instructions: 'Draft skills carefully.',
    source: 'builtin',
    readOnly: true,
    enabled: true,
    compatibleModes: ['thinking'],
    metadata: { requiredTools: ['skill'], disabledTools: [] },
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
    ...overrides,
  };
}

function withMockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init);
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function expectImmediate(result: ToolExecutionOutcome): ToolExecutionResult {
  assert.equal('deferred' in result, false);
  return result as ToolExecutionResult;
}

test('list_skills returns available built-in and user skills', async () => {
  const restore = withMockFetch(() => new Response(JSON.stringify({
    skills: [
      skillPayload(),
      skillPayload({ id: 'skill-2', name: 'writer', source: 'user', readOnly: false, instructions: 'ignored' }),
    ],
  })));

  try {
    const result = expectImmediate(await skillTool.execute(createInvocation('list_skills'), {}));
    assert.equal(result.ok, true);
    const data = result.data as { skills: Array<{ readOnly: boolean; source: string }> };
    assert.equal(data.skills[0]?.readOnly, true);
    assert.equal(data.skills[1]?.source, 'user');
  } finally {
    restore();
  }
});

test('view_skill loads the full built-in skill payload', async () => {
  const restore = withMockFetch(() => new Response(JSON.stringify({ skill: skillPayload() })));

  try {
    const result = expectImmediate(await skillTool.execute(createInvocation('view_skill', { skillName: 'skill-creator' }), {}));
    assert.equal(result.ok, true);
    const data = result.data as { source: string; readOnly: boolean; instructions: string };
    assert.equal(data.source, 'builtin');
    assert.equal(data.readOnly, true);
    assert.match(data.instructions, /Draft skills carefully/);
  } finally {
    restore();
  }
});

test('create_skill validates arguments and returns the created user skill', async () => {
  let requestBody = '';
  const restore = withMockFetch(async (_url, init) => {
    requestBody = String(init?.body ?? '');
    return new Response(JSON.stringify({
      skill: skillPayload({
        id: 'skill-2',
        name: 'writer',
        description: 'Write documents.',
        instructions: 'Write clearly.',
        source: 'user',
        readOnly: false,
      }),
    }));
  });

  try {
    const result = expectImmediate(await skillTool.execute(createInvocation('create_skill', {
      name: 'writer',
      description: 'Write documents.',
      instructions: 'Write clearly.',
      requiredTools: ['weather'],
    }), {}));
    assert.equal(result.ok, true);
    assert.match(requestBody, /"name":"writer"/);
    const data = result.data as { skill: { readOnly: boolean } };
    assert.equal(data.skill.readOnly, false);
  } finally {
    restore();
  }
});

test('update_skill updates a mutable skill by name', async () => {
  const calls: string[] = [];
  const restore = withMockFetch(async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.endsWith('/api/skills/by-name/writer')) {
      return new Response(JSON.stringify({
        skill: skillPayload({
          id: 'skill-2',
          name: 'writer',
          description: 'Old description.',
          instructions: 'Old instructions.',
          source: 'user',
          readOnly: false,
        }),
      }));
    }
    return new Response(JSON.stringify({
      skill: skillPayload({
        id: 'skill-2',
        name: 'writer',
        description: 'New description.',
        instructions: 'Old instructions.',
        source: 'user',
        readOnly: false,
      }),
    }));
  });

  try {
    const result = expectImmediate(await skillTool.execute(createInvocation('update_skill', {
      skillName: 'writer',
      description: 'New description.',
    }), {}));
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['GET /api/skills/by-name/writer', 'PUT /api/skills/skill-2']);
    const data = result.data as { skill: { description: string } };
    assert.equal(data.skill.description, 'New description.');
  } finally {
    restore();
  }
});

test('update_skill rejects built-in skills and missing updates', async () => {
  {
    const restore = withMockFetch(() => new Response(JSON.stringify({ skill: skillPayload() })));
    try {
      const result = expectImmediate(await skillTool.execute(createInvocation('update_skill', {
        skillName: 'skill-creator',
        description: 'Nope.',
      }), {}));
      assert.equal(result.ok, false);
      assert.match(result.summary, /read-only/i);
    } finally {
      restore();
    }
  }

  const result = expectImmediate(await skillTool.execute(createInvocation('update_skill', { skillName: 'writer' }), {}));
  assert.equal(result.ok, false);
  assert.match(result.summary, /at least one field/i);
});
