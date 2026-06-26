import type { NutritionGoals, NutritionMacroValues } from '../../../shared/nutrition-contract';

const macroRows = [
  { id: 'carbs', label: 'T. Carbs', valueKey: 'carbsG', targetKey: 'carbsTargetG', color: '#ff9d1d' },
  { id: 'protein', label: 'Protein', valueKey: 'proteinG', targetKey: 'proteinTargetG', color: '#1fc966' },
  { id: 'fat', label: 'Fat', valueKey: 'fatG', targetKey: 'fatTargetG', color: '#ffcf2f' },
] as const;

export function NutritionMacroBars({
  goals,
  totals,
}: {
  goals: NutritionGoals;
  totals: NutritionMacroValues;
}) {
  return (
    <div className="grid gap-3 min-[520px]:grid-cols-3">
      {macroRows.map((row) => {
        const value = totals[row.valueKey];
        const target = goals[row.targetKey];
        const percent = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
        const delta = Math.round(target - value);

        return (
          <div key={row.id}>
            <div className="flex items-center justify-between text-xs text-zinc-200">
              <span>{row.label}</span>
              <span>{percent}%</span>
            </div>
            <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#303030]">
              <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: row.color }} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-zinc-200">{Math.round(value)}g</span>
              <span className={delta >= 0 ? 'text-zinc-300' : 'text-[#ff9140]'}>{delta >= 0 ? `left ${delta}g` : `over ${Math.abs(delta)}g`}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
