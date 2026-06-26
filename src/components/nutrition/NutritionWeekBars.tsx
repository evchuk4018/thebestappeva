import type { NutritionDiaryEntry } from '../../../shared/nutrition-contract';
import { addDays, dateKey, shortDayLabel, weekRange } from './nutrition-utils';

export function NutritionWeekBars({
  entries,
  selectedDate,
  target,
}: {
  entries: NutritionDiaryEntry[];
  selectedDate: string;
  target: number;
}) {
  const { startDate } = weekRange(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
  const totalsByDay = new Map<string, number>();

  entries.forEach((entry) => {
    const key = dateKey(entry.loggedAt);
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + entry.nutritionTotal.calories);
  });

  const maxCalories = Math.max(target, ...days.map((day) => totalsByDay.get(day) ?? 0), 1);

  return (
    <div className="mt-8 border-t border-dashed border-zinc-700/70 pt-4">
      <div className="grid grid-cols-7 items-end gap-2">
        {days.map((day) => {
          const calories = totalsByDay.get(day) ?? 0;
          const barHeight = Math.max(8, Math.round((calories / maxCalories) * 46));
          const isSelected = day === selectedDate;
          const isOver = calories > target;

          return (
            <div key={day} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-12 items-end">
                <div className={`w-5 rounded-t-sm ${isOver ? 'bg-[#ff980f]' : 'bg-[#18b65c]'}`} style={{ height: `${barHeight}px` }} />
              </div>
              <div className={`text-center text-xs leading-tight ${isSelected ? 'text-[#69aee7]' : 'text-zinc-300'}`}>
                <p>{shortDayLabel(day)}</p>
                <p>{Number(day.slice(-2))}</p>
              </div>
              <div className={`h-0 w-0 border-x-[6px] border-x-transparent border-b-[9px] ${isSelected ? 'border-b-[#69aee7]' : 'border-b-transparent'}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
