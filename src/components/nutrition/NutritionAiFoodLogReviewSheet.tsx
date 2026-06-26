import { Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { NutritionDiaryEntryInput, NutritionSearchItem } from '../../../shared/nutrition-contract';
import type { NutritionAiFoodLogDraftItem, NutritionAiFoodLogResponse } from '../../../shared/nutrition-ai-food-log-contract';
import { isoFromDateAndTime } from './nutrition-utils';

interface ReviewRow extends NutritionAiFoodLogDraftItem {
  searchText: string;
}

function initialRows(response: NutritionAiFoodLogResponse): ReviewRow[] {
  return response.items.map((item) => ({ ...item, searchText: item.name }));
}

function optionLabel(item: NutritionSearchItem) {
  return `${item.itemType}:${item.id}`;
}

function parseOption(value: string, candidates: NutritionSearchItem[]) {
  return candidates.find((item) => optionLabel(item) === value) ?? null;
}

export function NutritionAiFoodLogReviewSheet({
  dateText,
  response,
  onClose,
  onSave,
  onSearch,
}: {
  dateText: string;
  response: NutritionAiFoodLogResponse;
  onClose: () => void;
  onSave: (input: NutritionDiaryEntryInput) => void;
  onSearch: (query: string, loggedAt: string) => Promise<NutritionSearchItem[] | null>;
}) {
  const [rows, setRows] = useState<ReviewRow[]>(() => initialRows(response));
  const [timeText, setTimeText] = useState('12:00');
  const loggableRows = rows.filter((row) => row.matchedItem);
  const canSave = rows.length > 0 && loggableRows.length === rows.length;

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function save() {
    onSave({
      loggedAt: isoFromDateAndTime(dateText, timeText),
      note: `AI Food Log: ${response.summary}`,
      items: loggableRows.map((row) => ({
        itemType: row.matchedItem!.itemType,
        itemId: row.matchedItem!.id,
        quantity: row.quantity,
        unit: row.unit,
        servingId: row.unit === 'serving' ? row.matchedItem!.defaultServingId : null,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-3 py-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col rounded-[30px] border border-zinc-800 bg-[#101111] shadow-2xl shadow-black/50">
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">AI Food Log</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Review meal draft</h2>
              <p className="mt-2 text-sm text-zinc-300">{response.summary}</p>
            </div>
            <button onClick={onClose} className="text-sm font-semibold text-zinc-400 hover:text-white">Close</button>
          </div>
          <label className="mt-4 block max-w-[150px] text-sm text-zinc-300">Time<input type="time" value={timeText} onChange={(event) => setTimeText(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {rows.map((row) => (
            <div key={row.id} className="rounded-[24px] border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{row.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{row.confidence} confidence{row.note ? ` · ${row.note}` : ''}</p>
                </div>
                <button onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="rounded-full border border-zinc-700 p-2 text-zinc-400 hover:text-white" aria-label={`Remove ${row.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_150px]">
                <label className="text-sm text-zinc-300">Match
                  <select value={row.matchedItem ? optionLabel(row.matchedItem) : ''} onChange={(event) => updateRow(row.id, { matchedItem: parseOption(event.target.value, row.candidates), needsReview: true })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none">
                    <option value="">Needs match</option>
                    {row.candidates.map((item) => <option key={optionLabel(item)} value={optionLabel(item)}>{item.name} · {item.itemType}</option>)}
                  </select>
                </label>
                <label className="text-sm text-zinc-300">Quantity<input value={row.quantity} onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value) })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none" /></label>
                <label className="text-sm text-zinc-300">Unit
                  <select value={row.unit} onChange={(event) => updateRow(row.id, { unit: event.target.value === 'serving' ? 'serving' : 'gram' })} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none">
                    <option value="gram">Grams</option>
                    <option value="serving">Serving</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <input value={row.searchText} onChange={(event) => updateRow(row.id, { searchText: event.target.value })} className="min-w-0 flex-1 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-white outline-none" />
                <button onClick={async () => {
                  const loggedAt = isoFromDateAndTime(dateText, timeText);
                  const candidates = await onSearch(row.searchText || row.name, loggedAt) ?? [];
                  updateRow(row.id, { candidates, matchedItem: candidates[0] ?? null, needsReview: true });
                }} className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">
                  <Search size={15} /> Find
                </button>
              </div>
              {!row.matchedItem ? <p className="mt-3 text-sm text-amber-300">Needs a local food or recipe match before saving.</p> : null}
            </div>
          ))}
          {!rows.length ? <div className="grid min-h-[180px] place-items-center text-sm text-zinc-500">No draft items.</div> : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">{response.warnings.join(' ')}</p>
          <button disabled={!canSave} onClick={save} className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">Save Entry</button>
        </div>
      </div>
    </div>
  );
}
