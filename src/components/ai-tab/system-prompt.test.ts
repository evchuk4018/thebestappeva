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
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'thinking',
    tools: [weatherTool],
    skills: [],
  });
  const content = buildSystemPromptContent({
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'thinking',
    tools: [weatherTool],
    skills: [],
  });

  assert(sections.some((section) => section.id === 'workflow'));
  assert.match(content, /When the request is short or simple, answer normally\./);
  assert.match(content, /break your work into explicit thinking blocks/i);
  assert.match(content, /call ask_user instead of guessing/i);
  assert.match(content, /Reserve the final assistant reply content for the final summary or result/i);
  assert.match(content, /Enabled tools:/);
  assert.match(content, /ask_user tool pauses the current turn/i);
  assert.match(content, /Every tool call must be emitted as one valid JSON tool invocation/i);
  assert.match(content, /Weather \(/);
});

test('flash mode excludes thinking workflow guidance', () => {
  const sections = buildSystemPromptSections({
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'flash',
    tools: [weatherTool],
    skills: [],
  });
  const content = buildSystemPromptContent({
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'flash',
    tools: [weatherTool],
    skills: [],
  });

  assert(!sections.some((section) => section.id === 'workflow'));
  assert.doesNotMatch(content, /explicit thinking blocks/i);
  assert.match(content, /Current mode: Flash\./);
  assert.doesNotMatch(content, /ask_user/i);
});

test('artifact guidance requires create_artifact for content requested in an artifact', () => {
  const content = buildSystemPromptContent({
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'thinking',
    tools: [weatherTool],
    skills: [],
  });

  assert.match(content, /When the user asks for content in an artifact, call create_artifact/i);
});

test('generated memory is injected before custom prompt content', () => {
  const sections = buildSystemPromptSections({
    generatedUserMemory: 'Prefers concise answers.',
    customPrompt: 'Call out tradeoffs.',
    mode: 'thinking',
    tools: [weatherTool],
    skills: [],
  });

  assert.equal(sections[0]?.id, 'memory');
  assert.equal(sections[1]?.id, 'custom');
});

test('skills section lists enabled skills and references view_skill', () => {
  const sections = buildSystemPromptSections({
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'thinking',
    tools: [],
    skills: [
      { id: 's1', name: 'skill-creator', description: 'Create reusable skills.', enabled: true, compatibleModes: null, requiredTools: [], disabledTools: [], createdAt: '', updatedAt: '' },
      { id: 's2', name: 'disabled-one', description: 'off', enabled: false, compatibleModes: null, requiredTools: [], disabledTools: [], createdAt: '', updatedAt: '' },
    ],
  });

  const skillsSection = sections.find((section) => section.id === 'skills');
  assert.ok(skillsSection, 'expected a skills section');
  assert.match(skillsSection.content, /<available_skills>/);
  assert.match(skillsSection.content, /skill-creator: Create reusable skills\./);
  assert.doesNotMatch(skillsSection.content, /disabled-one/);
  assert.match(skillsSection.content, /view_skill tool/);
});

test('skills section is omitted when no skills apply to the current mode', () => {
  const sections = buildSystemPromptSections({
    generatedUserMemory: '',
    customPrompt: '',
    mode: 'flash',
    tools: [],
    skills: [
      { id: 's1', name: 'thinking-only', description: 'd', enabled: true, compatibleModes: ['thinking'], requiredTools: [], disabledTools: [], createdAt: '', updatedAt: '' },
    ],
  });

  assert.ok(!sections.some((section) => section.id === 'skills'));
});
