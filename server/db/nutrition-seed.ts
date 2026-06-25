import type { NutritionServing } from '../../shared/nutrition-contract';
import { nutritionSeedGroups } from './nutrition-seed-data';

export interface SeedFood {
  id: string;
  name: string;
  servings: NutritionServing[];
  nutrition: { calories: number; proteinG: number; carbsG: number; fatG: number };
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function servingId(label: string) {
  return `serving_${slug(label)}`;
}

export const nutritionSeedFoods: SeedFood[] = nutritionSeedGroups.flatMap((group) =>
  group.names.map((name) => ({
    id: `food_${slug(name)}`,
    name,
    servings: [{ id: servingId(group.serving.label), label: group.serving.label, amount: 1, grams: group.serving.grams }],
    nutrition: group.nutrition,
  })),
);
