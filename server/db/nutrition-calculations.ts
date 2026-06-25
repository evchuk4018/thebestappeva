import type { NutritionFood, NutritionMacroValues, NutritionServing } from '../../shared/nutrition-contract';

export function zeroMacros(): NutritionMacroValues {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

export function roundNutrition(value: NutritionMacroValues): NutritionMacroValues {
  return {
    calories: Number(value.calories.toFixed(1)),
    proteinG: Number(value.proteinG.toFixed(1)),
    carbsG: Number(value.carbsG.toFixed(1)),
    fatG: Number(value.fatG.toFixed(1)),
  };
}

export function addMacros(left: NutritionMacroValues, right: NutritionMacroValues): NutritionMacroValues {
  return roundNutrition({
    calories: left.calories + right.calories,
    proteinG: left.proteinG + right.proteinG,
    carbsG: left.carbsG + right.carbsG,
    fatG: left.fatG + right.fatG,
  });
}

export function scaleMacros(macros: NutritionMacroValues, factor: number): NutritionMacroValues {
  return roundNutrition({
    calories: macros.calories * factor,
    proteinG: macros.proteinG * factor,
    carbsG: macros.carbsG * factor,
    fatG: macros.fatG * factor,
  });
}

export function scaleMacrosPer100g(macros: NutritionMacroValues, amountG: number): NutritionMacroValues {
  const scale = amountG / 100;
  return scaleMacros(macros, scale);
}

export function servingById(servings: NutritionServing[], servingId: string | null | undefined) {
  return servings.find((serving) => serving.id === servingId) ?? null;
}

export function resolveAmountG(food: NutritionFood, quantity: number, unit: 'gram' | 'serving', servingId: string | null | undefined) {
  if (unit === 'gram') return quantity;
  const serving = servingById(food.servings, servingId) ?? food.servings[0] ?? null;
  if (!serving) throw new Error(`Food "${food.name}" does not have a serving definition.`);
  return quantity * serving.grams;
}

export function timeSlotForIso(isoText: string) {
  const hour = new Date(isoText).getHours();
  if (hour < 5) return 'latenight' as const;
  if (hour < 11) return 'morning' as const;
  if (hour < 16) return 'midday' as const;
  if (hour < 22) return 'evening' as const;
  return 'latenight' as const;
}
