import { ExternalLink, History, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ArtifactEditorToolbar } from './ArtifactEditorToolbar';
import {
  insertCodeBlock,
  insertLink,
  insertTable,
  locateTableAroundSelection,
  toggleLinePrefix,
  wrapSelection,
  type TextSelectionRange,
} from './markdown-editing';
import { AssistantMessageContent } from '../AssistantMessageContent';
import { ArtifactRecord, ArtifactSummary, ArtifactVersionRecord } from '../../../lib/ai-artifacts-storage';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'failed';
type ToolbarAction = 'heading' | 'bold' | 'italic' | 'underline' | 'bullet' | 'numbered' | 'quote' | 'code' | 'link' | 'table' | 'paragraph';

interface ArtifactPanelProps {
  activeArtifact: ArtifactRecord | null;
  activeArtifactId: string | null;
  artifacts: ArtifactSummary[];
  includedArtifactIds: string[];
  onClose: () => void;
  onExport: (artifactId: string) => Promise<string | null>;
  onOpenArtifact: (artifactId: string) => void;
  onRestoreVersion: (artifactId: string, versionId: string) => Promise<void>;
  onRunSearch: (artifactId: string, query: string, mode: 'keyword' | 'heading' | 'hybrid') => Promise<void>;
  onSaveArtifact: (request: { artifactId: string; content?: string; title?: string; type?: string; reason: string }) => Promise<void>;
  onSetIncluded: (artifactId: string, included: boolean) => void;
  onUpdateTable: (request: Record<string, unknown>) => Promise<void>;
  outline: Array<{ heading: string; level: number; lineStart: number; lineEnd?: number; preview?: string }>;
  searchMatches: Array<{ lineStart: number; lineEnd: number; snippet: string; matchType: string }>;
  versions: ArtifactVersionRecord[];
}

export function ArtifactPanel(props: ArtifactPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [selection, setSelection] = useState<TextSelectionRange>({ start: 0, end: 0 });

  useEffect(() => {
    setDraft(props.activeArtifact?.content ?? '');
    setSaveStatus('saved');
  }, [props.activeArtifact?.artifactId, props.activeArtifact?.updatedAt]);

  useEffect(() => {
    if (!props.activeArtifactId || !props.activeArtifact || draft === props.activeArtifact.content || saveStatus === 'saving') {
      return;
    }
    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await props.onSaveArtifact({ artifactId: props.activeArtifact.artifactId, content: draft, reason: 'Manual artifact edit' });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('failed');
      }
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [draft, props, saveStatus]);

  if (!props.activeArtifactId || !props.activeArtifact) {
    return null;
  }

  const applyChange = (next: { value: string; selection: TextSelectionRange }) => {
    setDraft(next.value);
    setSelection(next.selection);
    setSaveStatus('unsaved');
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(next.selection.start, next.selection.end);
    });
  };

  const handleToolbarAction = (action: ToolbarAction) => {
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
  };

  const handleTableOperation = async (operation: string) => {
    const table = locateTableAroundSelection(draft, selection);
    if (!table) return;
    await props.onUpdateTable({
      artifactId: props.activeArtifact.artifactId,
      tableLocator: { startLine: table.startLine, endLine: table.endLine },
      operation,
      rowIndex: table.rowIndex,
      columnIndex: table.columnIndex,
      reason: `Manual ${operation.replaceAll('_', ' ')}`,
    });
  };

  return (
    <aside className="w-[440px] border-l border-[#1f2c37] bg-[#0d1318]">
      <div className="flex items-center justify-between border-b border-[#1f2c37] px-4 py-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8db4d0]">{props.activeArtifact.type}</p>
          <h3 className="truncate font-semibold text-white">{props.activeArtifact.title}</h3>
        </div>
        <button type="button" onClick={props.onClose} className="rounded-full border border-[#2b3c4d] p-2 text-zinc-400 transition hover:text-white"><X size={14} /></button>
      </div>

      <div className="flex items-center gap-2 border-b border-[#1f2c37] px-4 py-3 text-xs text-zinc-400">
        <select value={props.activeArtifact.artifactId} onChange={(event) => props.onOpenArtifact(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#243443] bg-[#0f1820] px-3 py-2 text-zinc-200">
          {props.artifacts.map((artifact) => <option key={artifact.artifactId} value={artifact.artifactId}>{artifact.title}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-[#243443] px-3 py-2">
          <input type="checkbox" checked={props.includedArtifactIds.includes(props.activeArtifact.artifactId)} onChange={(event) => props.onSetIncluded(props.activeArtifact.artifactId, event.target.checked)} />
          <span>Include</span>
        </label>
        <button type="button" onClick={async () => {
          const url = await props.onExport(props.activeArtifact.artifactId);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        }} className="flex items-center gap-1 rounded-lg border border-[#35536e] px-3 py-2 text-[#d9e9f5] transition hover:text-white">
          <ExternalLink size={13} />
          <span>Export</span>
        </button>
      </div>

      <ArtifactEditorToolbar onAction={handleToolbarAction} />

      <div className="flex items-center gap-2 border-b border-[#1f2c37] px-4 py-3 text-xs text-zinc-400">
        <span>{saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving' : saveStatus === 'unsaved' ? 'Unsaved' : 'Save failed'}</span>
        <button type="button" onClick={() => void handleTableOperation('insert_row_below')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Row +</button>
        <button type="button" onClick={() => void handleTableOperation('delete_row')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Row -</button>
        <button type="button" onClick={() => void handleTableOperation('insert_column_right')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Col +</button>
        <button type="button" onClick={() => void handleTableOperation('delete_column')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Col -</button>
      </div>

      <div className="grid h-[calc(100vh-205px)] grid-rows-[1.1fr_0.9fr]">
        <div className="overflow-auto border-b border-[#1f2c37] px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Search size={14} className="text-zinc-500" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search this artifact" className="flex-1 rounded-lg border border-[#243443] bg-[#0f1820] px-3 py-2 text-sm text-zinc-100 outline-none" />
            <button type="button" onClick={() => void props.onRunSearch(props.activeArtifact.artifactId, searchQuery, 'hybrid')} className="rounded-lg border border-[#35536e] px-3 py-2 text-xs text-[#d9e9f5] transition hover:text-white">Go</button>
          </div>
          <div className="mb-4 rounded-2xl border border-[#1d2c39] bg-[#0f161d] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Preview</p>
            <AssistantMessageContent content={draft} />
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onBlur={(event) => setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaveStatus('unsaved');
              setSelection({ start: event.target.selectionStart, end: event.target.selectionEnd });
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
                event.preventDefault();
                handleToolbarAction('bold');
              }
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
                event.preventDefault();
                handleToolbarAction('italic');
              }
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                handleToolbarAction('link');
              }
            }}
            onSelect={(event) => setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
            className="min-h-[280px] w-full rounded-2xl border border-[#243443] bg-[#081017] p-4 font-mono text-sm leading-6 text-zinc-100 outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-0 overflow-hidden">
          <div className="overflow-auto border-r border-[#1f2c37] px-4 py-4">
            <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Outline</p>
            <div className="space-y-2 text-xs text-zinc-300">
              {props.outline.map((entry) => (
                <button key={`${entry.heading}-${entry.lineStart}`} type="button" onClick={() => {
                  const offset = draft.split('\n').slice(0, entry.lineStart - 1).join('\n').length + (entry.lineStart > 1 ? 1 : 0);
                  textareaRef.current?.focus();
                  textareaRef.current?.setSelectionRange(offset, offset);
                }} className="block w-full rounded-xl bg-[#111922] px-3 py-2 text-left" style={{ marginLeft: `${(entry.level - 1) * 8}px` }}>
                  {entry.heading}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto border-r border-[#1f2c37] px-4 py-4">
            <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Matches</p>
            <div className="space-y-2 text-xs text-zinc-300">
              {props.searchMatches.map((match) => (
                <div key={`${match.lineStart}-${match.lineEnd}-${match.snippet}`} className="rounded-xl bg-[#111922] px-3 py-2">
                  <p className="font-medium text-white">Lines {match.lineStart}-{match.lineEnd}</p>
                  <p className="mt-1 text-zinc-400">{match.snippet}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-auto px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <History size={12} />
              <span>History</span>
            </div>
            <div className="space-y-2 text-xs text-zinc-300">
              {props.versions.map((version) => (
                <button key={version.versionId} type="button" onClick={() => void props.onRestoreVersion(props.activeArtifact!.artifactId, version.versionId)} className="block w-full rounded-xl bg-[#111922] px-3 py-2 text-left">
                  <p className="font-medium text-white">{version.reason}</p>
                  <p className="mt-1 text-zinc-500">{new Date(version.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
