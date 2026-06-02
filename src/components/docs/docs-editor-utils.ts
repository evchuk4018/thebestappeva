import { Editor } from '@tiptap/react';
import { DocTabRecord } from './docs-types';

export function getActiveTab(tabs: DocTabRecord[], tabId: string) {
  return tabs.find((tab) => tab.id === tabId) ?? tabs[0] ?? null;
}

export function buildOutlineFromHtml(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;

  return Array.from(container.querySelectorAll('h1, h2, h3'))
    .map((node, index) => ({
      id: `heading-${index}`,
      level: Number(node.tagName[1]),
      text: node.textContent?.trim() || 'Untitled section',
    }))
    .filter((item) => item.text);
}

export function buildEditorSnapshot(editor: Editor, currentTab: DocTabRecord) {
  return {
    ...currentTab,
    content: JSON.stringify(editor.getJSON()),
    contentFormat: 'json' as const,
    textContent: editor.getText(),
  };
}

export function buildHtmlExport(editor: Editor) {
  return editor.getHTML();
}
