import { useEffect, useRef } from 'react';
import { AssistantMessageContent } from '../AssistantMessageContent';

interface ArtifactPreviewPaneProps {
  content: string;
  highlightKey: number;
  highlightQuery: string | null;
}

function clearHighlights(container: HTMLElement) {
  const highlights = [...container.querySelectorAll<HTMLElement>('mark[data-artifact-preview-highlight="true"]')];

  highlights.forEach((highlight) => {
    const parent = highlight.parentNode;

    if (!parent) {
      return;
    }

    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }

    parent.removeChild(highlight);
    parent.normalize();
  });
}

function highlightContent(container: HTMLElement, query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const matcher = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = node.parentElement;
      if (!node.textContent?.trim() || parentElement?.closest('pre, code, mark[data-artifact-preview-highlight="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  let firstHighlight: HTMLElement | null = null;

  textNodes.forEach((textNode) => {
    const value = textNode.data;
    const matches = [...value.matchAll(matcher)];

    if (!matches.length) {
      return;
    }

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach((match) => {
      const start = match.index ?? 0;

      if (start > lastIndex) {
        fragment.append(value.slice(lastIndex, start));
      }

      const mark = document.createElement('mark');
      mark.dataset.artifactPreviewHighlight = 'true';
      mark.className = 'artifact-preview-highlight';
      mark.textContent = match[0];
      fragment.append(mark);

      if (!firstHighlight) {
        firstHighlight = mark;
      }

      lastIndex = start + match[0].length;
    });

    if (lastIndex < value.length) {
      fragment.append(value.slice(lastIndex));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  firstHighlight?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return firstHighlight;
}

export function ArtifactPreviewPane({ content, highlightKey, highlightQuery }: ArtifactPreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = previewRef.current;

    if (!container) {
      return;
    }

    clearHighlights(container);

    if (!highlightQuery) {
      return;
    }

    highlightContent(container, highlightQuery);
    return () => clearHighlights(container);
  }, [content, highlightKey, highlightQuery]);

  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
      <div className="mx-auto min-h-full max-w-4xl rounded-[28px] border border-[#1d2c39] bg-[#11161d] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
        <div ref={previewRef}>
          <AssistantMessageContent content={content} />
        </div>
      </div>
    </div>
  );
}
