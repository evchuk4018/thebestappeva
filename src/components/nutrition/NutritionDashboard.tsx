import { useRef } from 'react';
import type { NutritionDiaryEntry, NutritionGoals } from '../../../shared/nutrition-contract';
import { NutritionAdviceStrip } from './NutritionAdviceStrip';
import { NutritionAppleRing } from './NutritionAppleRing';
import { NutritionDiaryList } from './NutritionDiaryList';
import { NutritionMacroBars } from './NutritionMacroBars';
import { NutritionWeekBars } from './NutritionWeekBars';
import { diaryTotals } from './nutrition-utils';

export function NutritionDashboard({
  entries,
  goals,
  selectedDate,
  weekEntries,
  onEditGoals,
  onDeleteEntry,
  onEditEntry,
}: {
  entries: NutritionDiaryEntry[];
  goals: NutritionGoals;
  selectedDate: string;
  weekEntries: NutritionDiaryEntry[];
  onEditGoals: () => void;
  onDeleteEntry: (entryId: string) => void;
  onEditEntry: (entry: NutritionDiaryEntry) => void;
}) {
  const totals = diaryTotals(entries);
  const mealsRef = useRef<HTMLElement | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-col px-2 pb-5 pt-2">
      <section className="rounded-lg bg-[#171719] px-4 pb-4 pt-3 shadow-2xl shadow-black/40">
        <div className="relative text-center">
          <p className="text-sm text-zinc-300">Calorie Budget</p>
          <p className="text-2xl leading-7 text-[#69aee7]">{Math.round(goals.caloriesTarget).toLocaleString('en-US').replace(/,/g, ' ')}</p>
          <button onClick={onEditGoals} className="absolute right-0 top-0 rounded-full p-1 text-lg leading-none text-zinc-400 hover:text-white" aria-label="Edit calorie and macro goals">
            ...
          </button>
        </div>

        <NutritionAppleRing calories={totals.calories} target={goals.caloriesTarget} />

        <div className="-mt-1 text-center">
          <button onClick={() => mealsRef.current?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-semibold text-[#69aee7] hover:text-[#8fc4ef]">
            View All Meals
          </button>
        </div>

        <div className="mt-6">
          <NutritionMacroBars goals={goals} totals={totals} />
        </div>

        <NutritionWeekBars entries={weekEntries} selectedDate={selectedDate} target={goals.caloriesTarget} />
      </section>

      <NutritionAdviceStrip />

      <section ref={mealsRef} className="mt-5 scroll-mt-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">All Meals</h2>
          <p className="text-sm text-zinc-500">{entries.length} entries</p>
        </div>
        {entries.length ? <NutritionDiaryList entries={entries} onDelete={onDeleteEntry} onEdit={onEditEntry} /> : (
          <div className="rounded-lg border border-dashed border-zinc-700 bg-[#171719] p-6 text-center text-sm text-zinc-400">
            Nothing logged yet for this day. Use the top menu to add food or a recipe.
          </div>
        )}
      </section>
    </div>
  );
}
