import type { NutritionDiaryEntry, NutritionGoals, NutritionMacroValues } from '../../../shared/nutrition-contract';

export function todayKey() {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

export function addDays(dateText: string, amount: number) {
  const value = new Date(`${dateText}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return new Intl.DateTimeFormat('en-CA').format(value);
}

export function entryTimeValue(isoText: string) {
  const date = new Date(isoText);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isoFromDateAndTime(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText}:00`).toISOString();
}

export function sumMacros(items: NutritionMacroValues[]) {
  return items.reduce((sum, item) => ({
    calories: Number((sum.calories + item.calories).toFixed(1)),
    proteinG: Number((sum.proteinG + item.proteinG).toFixed(1)),
    carbsG: Number((sum.carbsG + item.carbsG).toFixed(1)),
    fatG: Number((sum.fatG + item.fatG).toFixed(1)),
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
}

export function diaryTotals(entries: NutritionDiaryEntry[]) {
  return sumMacros(entries.map((entry) => entry.nutritionTotal));
}

export function macroProgress(current: NutritionMacroValues, goals: NutritionGoals) {
  return [
    { id: 'calories', label: 'Calories', value: current.calories, target: goals.caloriesTarget, accent: 'bg-orange-400' },
    { id: 'protein', label: 'Protein', value: current.proteinG, target: goals.proteinTargetG, accent: 'bg-emerald-400' },
    { id: 'carbs', label: 'Carbs', value: current.carbsG, target: goals.carbsTargetG, accent: 'bg-sky-400' },
    { id: 'fat', label: 'Fat', value: current.fatG, target: goals.fatTargetG, accent: 'bg-amber-400' },
  ];
}

export function quantityText(quantity: number, unit: 'gram' | 'serving', servingLabel: string | null) {
  if (unit === 'gram') return `${Number(quantity.toFixed(1))} g`;
  return `${Number(quantity.toFixed(2))} ${servingLabel ?? 'servings'}`;
}
