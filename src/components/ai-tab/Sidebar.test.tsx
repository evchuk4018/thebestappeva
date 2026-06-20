import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from './Sidebar';
import type { Chat } from './types';

function chat(id: string, title: string): Chat {
  return {
    id,
    title,
    titleStatus: 'finalized',
    messages: [],
    activeArtifactId: null,
    includedArtifactIds: [],
    mode: 'thinking',
    updatedAt: '2026-06-19T00:00:00.000Z',
  };
}

function render(activePanel: 'chats' | 'tools' | 'skills' | 'automations') {
  return renderToStaticMarkup(
    <Sidebar
      activePanel={activePanel}
      chats={[chat('chat-1', 'Meal plan'), chat('chat-2', 'Workout split')]}
      isMobile={false}
      sessionTitle="Session"
      selectedChatId="chat-1"
      sidebarOpen
      onClose={() => {}}
      onDeleteChat={() => {}}
      onNavigateHome={() => {}}
      onNewChat={() => {}}
      onOpenSettings={() => {}}
      onSelectChat={() => {}}
      onSelectPanel={() => {}}
    />,
  );
}

test('keeps chat history visible while tools are active', () => {
  const html = render('tools');
  assert.match(html, /Meal plan/);
  assert.match(html, /Workout split/);
  assert.doesNotMatch(html, /Tools open in the main workspace/);
});

test('keeps chat history visible while skills are active', () => {
  const html = render('skills');
  assert.match(html, /Meal plan/);
  assert.match(html, /Workout split/);
  assert.doesNotMatch(html, /Skills open in the main workspace/);
});

test('keeps chat history visible while automations are active', () => {
  const html = render('automations');
  assert.match(html, /Meal plan/);
  assert.match(html, /Workout split/);
});
