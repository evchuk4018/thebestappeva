import type { NutritionDiaryEntry } from '../../../shared/nutrition-contract';
import { quantityText } from './nutrition-utils';

export function NutritionDiaryList({
  entries,
  onDelete,
  onEdit,
}: {
  entries: NutritionDiaryEntry[];
  onDelete: (entryId: string) => void;
  onEdit: (entry: NutritionDiaryEntry) => void;
}) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-[26px] border border-zinc-800 bg-zinc-900/80 p-4 shadow-xl shadow-black/25">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{new Date(entry.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{entry.items.map((item) => item.name).join(', ')}</h3>
              {entry.note ? <p className="mt-2 text-sm text-zinc-400">{entry.note}</p> : null}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{Math.round(entry.nutritionTotal.calories)}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">cals</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {entry.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm text-zinc-300">
                <span>{item.brandName ? `${item.brandName} ${item.name}` : item.name}</span>
                <span className="text-zinc-500">{quantityText(item.quantity, item.unit, item.servingLabel)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
            <span>{Math.round(entry.nutritionTotal.proteinG)}P / {Math.round(entry.nutritionTotal.carbsG)}C / {Math.round(entry.nutritionTotal.fatG)}F</span>
            <div className="flex gap-3">
              <button onClick={() => onEdit(entry)} className="hover:text-white">Edit</button>
              <button onClick={() => onDelete(entry.id)} className="text-red-300 hover:text-red-200">Delete</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
