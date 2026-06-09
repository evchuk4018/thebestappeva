import type { RefObject } from 'react';
import { ArtifactEditorToolbar } from './ArtifactEditorToolbar';
import type { SearchSelectionRange } from './artifact-search';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'failed';
type ToolbarAction = 'heading' | 'bold' | 'italic' | 'underline' | 'bullet' | 'numbered' | 'quote' | 'code' | 'link' | 'table' | 'paragraph';

interface ArtifactCodePaneProps {
  draft: string;
  saveStatus: SaveStatus;
  selection: SearchSelectionRange;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onBlurSelection: (selection: SearchSelectionRange) => void;
  onChange: (value: string, selection: SearchSelectionRange) => void;
  onSelect: (selection: SearchSelectionRange) => void;
  onTableOperation: (operation: string) => Promise<void>;
  onToolbarAction: (action: ToolbarAction) => void;
}

function saveStatusLabel(saveStatus: SaveStatus) {
  if (saveStatus === 'saving') return 'Saving';
  if (saveStatus === 'unsaved') return 'Unsaved';
  if (saveStatus === 'failed') return 'Save failed';
  return 'Saved';
}

export function ArtifactCodePane({
  draft,
  saveStatus,
  selection,
  textareaRef,
  onBlurSelection,
  onChange,
  onSelect,
  onTableOperation,
  onToolbarAction,
}: ArtifactCodePaneProps) {
  return (
    <>
      <ArtifactEditorToolbar onAction={onToolbarAction} />

      <div className="flex flex-wrap items-center gap-2 border-b border-[#1f2c37] px-4 py-3 text-xs text-zinc-400">
        <span>{saveStatusLabel(saveStatus)}</span>
        <button type="button" onClick={() => void onTableOperation('insert_row_below')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Row +</button>
        <button type="button" onClick={() => void onTableOperation('delete_row')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Row -</button>
        <button type="button" onClick={() => void onTableOperation('insert_column_right')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Col +</button>
        <button type="button" onClick={() => void onTableOperation('delete_column')} className="rounded-lg border border-[#243443] px-2 py-1 hover:text-white">Col -</button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
        <textarea
          ref={textareaRef}
          value={draft}
          onBlur={(event) => onBlurSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
          onChange={(event) => onChange(event.target.value, { start: event.target.selectionStart, end: event.target.selectionEnd })}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
              event.preventDefault();
              onToolbarAction('bold');
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
              event.preventDefault();
              onToolbarAction('italic');
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
              event.preventDefault();
              onToolbarAction('link');
            }
          }}
          onSelect={() => onSelect({
            start: textareaRef.current?.selectionStart ?? selection.start,
            end: textareaRef.current?.selectionEnd ?? selection.end,
          })}
          className="min-h-full w-full rounded-[28px] border border-[#243443] bg-[#081017] p-5 font-mono text-sm leading-6 text-zinc-100 outline-none"
        />
      </div>
    </>
  );
}
