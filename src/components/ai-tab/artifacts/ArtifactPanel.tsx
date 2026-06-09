import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ArtifactSearchResponse } from '../../../../shared/ai-artifacts-contract';
import type { ArtifactRecord, ArtifactSummary } from '../../../lib/ai-artifacts-storage';
import { ArtifactCodePane } from './ArtifactCodePane';
import { ArtifactPanelHeader } from './ArtifactPanelHeader';
import { ArtifactPreviewPane } from './ArtifactPreviewPane';
import { ArtifactResizeHandle } from './ArtifactResizeHandle';
import { ArtifactSearchBar } from './ArtifactSearchBar';
import { ArtifactViewModeToggle, type ArtifactViewMode } from './ArtifactViewModeToggle';
import { getSelectionForSearchMatch } from './artifact-search';
import {
  insertCodeBlock,
  insertLink,
  insertTable,
  locateTableAroundSelection,
  toggleLinePrefix,
  wrapSelection,
  type TextSelectionRange,
} from './markdown-editing';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'failed';
type ToolbarAction = 'heading' | 'bold' | 'italic' | 'underline' | 'bullet' | 'numbered' | 'quote' | 'code' | 'link' | 'table' | 'paragraph';

interface ArtifactPanelProps {
  activeArtifact: ArtifactRecord | null;
  activeArtifactId: string | null;
  artifacts: ArtifactSummary[];
  includedArtifactIds: string[];
  isResizable: boolean;
  isResizing: boolean;
  panelWidth: number;
  onClose: () => void;
  onExport: (artifactId: string) => Promise<string | null>;
  onOpenArtifact: (artifactId: string) => void;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onRunSearch: (artifactId: string, query: string, mode: 'keyword' | 'heading' | 'hybrid') => Promise<ArtifactSearchResponse | null>;
  onSaveArtifact: (request: { artifactId: string; content?: string; title?: string; type?: string; reason: string }) => Promise<void>;
  onSetIncluded: (artifactId: string, included: boolean) => void;
  onUpdateTable: (request: Record<string, unknown>) => Promise<void>;
}

export function ArtifactPanel({
  activeArtifact,
  activeArtifactId,
  artifacts,
  includedArtifactIds,
  isResizable,
  isResizing,
  panelWidth,
  onClose,
  onExport,
  onOpenArtifact,
  onResizePointerDown,
  onRunSearch,
  onSaveArtifact,
  onSetIncluded,
  onUpdateTable,
}: ArtifactPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const clearSearchTimerRef = useRef<number | null>(null);
  const activeSearchSelectionRef = useRef<TextSelectionRange | null>(null);
  const [draft, setDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [searchHighlightKey, setSearchHighlightKey] = useState(0);
  const [searchHighlightQuery, setSearchHighlightQuery] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selection, setSelection] = useState<TextSelectionRange>({ start: 0, end: 0 });
  const [viewMode, setViewMode] = useState<ArtifactViewMode>('preview');

  function clearTransientSearch() {
    if (clearSearchTimerRef.current !== null) {
      window.clearTimeout(clearSearchTimerRef.current);
      clearSearchTimerRef.current = null;
    }

    if (activeSearchSelectionRef.current && textareaRef.current) {
      const { start, end } = activeSearchSelectionRef.current;
      if (textareaRef.current.selectionStart === start && textareaRef.current.selectionEnd === end) {
        textareaRef.current.setSelectionRange(end, end);
      }
    }

    activeSearchSelectionRef.current = null;
    setSearchHighlightQuery(null);
  }

  useEffect(() => {
    setDraft(activeArtifact?.content ?? '');
    setSaveStatus('saved');
    setSelection({ start: 0, end: 0 });
    setViewMode('preview');
    clearTransientSearch();
  }, [activeArtifact?.artifactId, activeArtifact?.updatedAt]);

  useEffect(() => {
    if (!activeArtifactId || !activeArtifact || draft === activeArtifact.content || saveStatus === 'saving') {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await onSaveArtifact({ artifactId: activeArtifact.artifactId, content: draft, reason: 'Manual artifact edit' });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('failed');
      }
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [activeArtifact, activeArtifactId, draft, onSaveArtifact, saveStatus]);

  useEffect(() => () => clearTransientSearch(), []);

  if (!activeArtifactId || !activeArtifact) {
    return null;
  }

  function scheduleTransientSearchClear() {
    clearSearchTimerRef.current = window.setTimeout(() => {
      clearTransientSearch();
    }, 2500);
  }

  function focusEditorSelection(nextSelection: TextSelectionRange) {
    activeSearchSelectionRef.current = nextSelection;
    setSelection(nextSelection);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextSelection.start, nextSelection.end);
    });
  }

  function applyChange(next: { value: string; selection: TextSelectionRange }) {
    setDraft(next.value);
    setSelection(next.selection);
    setSaveStatus('unsaved');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(next.selection.start, next.selection.end);
    });
  }

  function handleToolbarAction(action: ToolbarAction) {
    if (action === 'heading') applyChange(toggleLinePrefix(draft, selection, '# '));
    if (action === 'paragraph') applyChange(toggleLinePrefix(draft, selection, '# '));
    if (action === 'bold') applyChange(wrapSelection(draft, selection, '**'));
    if (action === 'italic') applyChange(wrapSelection(draft, selection, '*'));
    if (action === 'underline') applyChange(wrapSelection(draft, selection, '<u>', '</u>'));
    if (action === 'bullet') applyChange(toggleLinePrefix(draft, selection, '- '));
    if (action === 'numbered') applyChange(toggleLinePrefix(draft, selection, '1. '));
    if (action === 'quote') applyChange(toggleLinePrefix(draft, selection, '> '));
    if (action === 'code') applyChange(insertCodeBlock(draft, selection));
    if (action === 'link') applyChange(insertLink(draft, selection));
    if (action === 'table') applyChange(insertTable(draft, selection));
  }

  async function handleTableOperation(operation: string) {
    const table = locateTableAroundSelection(draft, selection);
    if (!table) return;

    await onUpdateTable({
      artifactId: activeArtifact.artifactId,
      tableLocator: { startLine: table.startLine, endLine: table.endLine },
      operation,
      rowIndex: table.rowIndex,
      columnIndex: table.columnIndex,
      reason: `Manual ${operation.replaceAll('_', ' ')}`,
    });
  }

  async function handleSearch() {
    const query = searchQuery.trim();

    if (!query) {
      clearTransientSearch();
      return;
    }

    const result = await onRunSearch(activeArtifact.artifactId, query, 'hybrid');
    const firstMatch = result?.matches[0];
    clearTransientSearch();

    if (!firstMatch) {
      return;
    }

    if (viewMode === 'code') {
      focusEditorSelection(getSelectionForSearchMatch(draft, firstMatch, query));
    } else {
      setSearchHighlightKey((current) => current + 1);
      setSearchHighlightQuery(query);
    }

    scheduleTransientSearchClear();
  }

  return (
    <aside className={`relative flex h-full min-w-0 flex-col border-l border-[#1f2c37] bg-[#0d1318] ${isResizing ? 'select-none' : ''}`} style={{ width: `${panelWidth}px` }}>
      <ArtifactResizeHandle isResizable={isResizable} isResizing={isResizing} onPointerDown={onResizePointerDown} />
      <ArtifactPanelHeader
        activeArtifact={activeArtifact}
        artifacts={artifacts}
        includedArtifactIds={includedArtifactIds}
        onClose={onClose}
        onExport={async () => {
          const url = await onExport(activeArtifact.artifactId);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        }}
        onOpenArtifact={onOpenArtifact}
        onSetIncluded={(included) => onSetIncluded(activeArtifact.artifactId, included)}
      />
      <ArtifactViewModeToggle
        mode={viewMode}
        onChange={(mode) => {
          clearTransientSearch();
          setViewMode(mode);
        }}
      />
      <ArtifactSearchBar
        query={searchQuery}
        onChange={(value) => {
          clearTransientSearch();
          setSearchQuery(value);
        }}
        onSubmit={() => void handleSearch()}
      />
      <div className="min-h-0 flex-1">
        {viewMode === 'preview' ? (
          <ArtifactPreviewPane content={draft} highlightKey={searchHighlightKey} highlightQuery={searchHighlightQuery} />
        ) : (
          <ArtifactCodePane
            draft={draft}
            saveStatus={saveStatus}
            selection={selection}
            textareaRef={textareaRef}
            onBlurSelection={setSelection}
            onChange={(value, nextSelection) => {
              setDraft(value);
              setSaveStatus('unsaved');
              setSelection(nextSelection);
            }}
            onSelect={setSelection}
            onTableOperation={handleTableOperation}
            onToolbarAction={handleToolbarAction}
          />
        )}
      </div>
    </aside>
  );
}
