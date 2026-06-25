import type { NutritionDiaryEntry, NutritionGoals } from '../../../shared/nutrition-contract';
import { NutritionDiaryList } from './NutritionDiaryList';
import { diaryTotals, macroProgress } from './nutrition-utils';

export function NutritionDashboard({
  entries,
  goals,
  onEditGoals,
  onDeleteEntry,
  onEditEntry,
  onOpenSearch,
}: {
  entries: NutritionDiaryEntry[];
  goals: NutritionGoals;
  onEditGoals: () => void;
  onDeleteEntry: (entryId: string) => void;
  onEditEntry: (entry: NutritionDiaryEntry) => void;
  onOpenSearch: () => void;
}) {
  const totals = diaryTotals(entries);
  const progress = macroProgress(totals, goals);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <section className="overflow-hidden rounded-[32px] border border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.32),_transparent_48%),linear-gradient(180deg,_#191b1d_0%,_#101112_100%)] p-5 shadow-2xl shadow-black/35">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Daily Budget</p>
            <p className="mt-3 text-5xl font-bold text-white">{Math.round(totals.calories)}</p>
            <p className="mt-2 text-sm text-zinc-300">{totals.calories > goals.caloriesTarget ? `${Math.round(totals.calories - goals.caloriesTarget)} over goal` : `${Math.round(goals.caloriesTarget - totals.calories)} left`}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={onOpenSearch} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-950/40 hover:bg-emerald-400">
              Log Food
            </button>
            <button onClick={onEditGoals} className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white">
              Edit Goals
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {progress.map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-800/80 bg-black/20 p-3">
              <div className="flex items-center justify-between text-sm text-zinc-200">
                <span>{item.label}</span>
                <span>{Math.round(item.value)} / {Math.round(item.target)}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-zinc-800">
                <div className={`${item.accent} h-2 rounded-full`} style={{ width: `${Math.min(100, (item.value / Math.max(item.target, 1)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Timeline</h2>
          <p className="text-sm text-zinc-500">{entries.length} entries</p>
        </div>
        {entries.length ? <NutritionDiaryList entries={entries} onDelete={onDeleteEntry} onEdit={onEditEntry} /> : (
          <div className="rounded-[28px] border border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
            Nothing logged yet for this day. Use the green button to add food or a recipe.
          </div>
        )}
      </section>
    </div>
  );
}
