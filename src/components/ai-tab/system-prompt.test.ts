import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSystemPromptContent, buildSystemPromptSections } from './system-prompt';

const weatherTool = {
  id: 'weather',
  label: 'Weather',
  alias: '/weather',
  description: 'Weather lookup',
  enabledByDefault: true,
  functions: [{ name: 'get_weather', description: 'Get weather', parameters: [] }],
};

test('thinking mode includes workflow guidance alongside tool guidance', () => {
  const sections = buildSystemPromptSections({
    customPrompt: '',
    mode: 'thinking',
    tools: [weatherTool],
  });
  const content = buildSystemPromptContent({
    customPrompt: '',
    mode: 'thinking',
    tools: [weatherTool],
  });

  assert(sections.some((section) => section.id === 'workflow'));
  assert.match(content, /When the request is short or simple, answer normally\./);
  assert.match(content, /break your work into explicit thinking blocks/i);
  assert.match(content, /Reserve the final assistant reply content for the final summary or result/i);
  assert.match(content, /Enabled tools:/);
  assert.match(content, /Weather \(/);
});

test('flash mode excludes thinking workflow guidance', () => {
  const sections = buildSystemPromptSections({
    customPrompt: '',
    mode: 'flash',
    tools: [weatherTool],
  });
  const content = buildSystemPromptContent({
    customPrompt: '',
    mode: 'flash',
    tools: [weatherTool],
  });

  assert(!sections.some((section) => section.id === 'workflow'));
  assert.doesNotMatch(content, /explicit thinking blocks/i);
  assert.match(content, /Current mode: Flash\./);
});
