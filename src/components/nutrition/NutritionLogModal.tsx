import { useState } from 'react';
import type { NutritionDiaryEntryInput } from '../../../shared/nutrition-contract';
import { entryTimeValue, isoFromDateAndTime } from './nutrition-utils';

export function NutritionLogModal({
  dateText,
  defaultQuantity,
  defaultServingId,
  defaultServingLabel,
  itemId,
  itemName,
  itemType,
  loggedAt,
  note,
  onClose,
  onSave,
  unit,
}: {
  dateText: string;
  defaultQuantity: number;
  defaultServingId?: string | null;
  defaultServingLabel?: string | null;
  itemId: string;
  itemName: string;
  itemType: 'food' | 'recipe';
  loggedAt?: string;
  note?: string;
  onClose: () => void;
  onSave: (input: NutritionDiaryEntryInput) => void;
  unit: 'gram' | 'serving';
}) {
  const [quantity, setQuantity] = useState(String(defaultQuantity));
  const [timeText, setTimeText] = useState(loggedAt ? entryTimeValue(loggedAt) : '12:00');
  const [noteText, setNoteText] = useState(note ?? '');
  const [unitValue, setUnitValue] = useState<'gram' | 'serving'>(unit);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-3 py-5 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            loggedAt: isoFromDateAndTime(dateText, timeText),
            note: noteText,
            items: [{ itemType, itemId, quantity: Number(quantity), unit: unitValue, servingId: unitValue === 'serving' ? defaultServingId ?? null : null }],
          });
        }}
        className="mx-auto max-w-lg rounded-[30px] border border-zinc-800 bg-[#111214] p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Log Item</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{itemName}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-400 hover:text-white">Close</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-zinc-300">Quantity<input value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          <label className="text-sm text-zinc-300">Time<input type="time" value={timeText} onChange={(event) => setTimeText(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setUnitValue('gram')} className={`rounded-full px-4 py-2 text-sm font-semibold ${unitValue === 'gram' ? 'bg-emerald-500 text-zinc-950' : 'border border-zinc-700 text-zinc-300'}`}>Grams</button>
          <button type="button" onClick={() => setUnitValue('serving')} className={`rounded-full px-4 py-2 text-sm font-semibold ${unitValue === 'serving' ? 'bg-emerald-500 text-zinc-950' : 'border border-zinc-700 text-zinc-300'}`}>
            {defaultServingLabel ?? 'Serving'}
          </button>
        </div>
        <label className="mt-4 block text-sm text-zinc-300">Note<textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} className="mt-2 min-h-[110px] w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Cancel</button>
          <button type="submit" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">Save Entry</button>
        </div>
      </form>
    </div>
  );
}
