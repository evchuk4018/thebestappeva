import { useCallback, useEffect, useState } from 'react';
import type { NutritionBootstrap, NutritionDiaryEntry, NutritionDiaryEntryInput, NutritionDiaryItemInput, NutritionFoodInput, NutritionGoalsInput, NutritionRecipe, NutritionRecipeInput, NutritionSearchItem } from '../../../shared/nutrition-contract';
import {
  appendNutritionEntryItem,
  createNutritionBrandFood,
  createNutritionEntry,
  createNutritionRecipe,
  deleteNutritionEntry,
  deleteNutritionEntryItem,
  fetchNutritionBootstrap,
  saveNutritionGoals,
  searchNutritionItems,
  updateNutritionEntry,
  updateNutritionEntryItem,
  updateNutritionRecipe,
} from './nutrition-api';
import { todayKey } from './nutrition-utils';

export function useNutrition() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [bootstrap, setBootstrap] = useState<NutritionBootstrap | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (date = selectedDate) => {
    setBusy(true);
    setError(null);
    try {
      setBootstrap(await fetchNutritionBootstrap(date));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load nutrition data.');
    } finally {
      setBusy(false);
    }
  }, [selectedDate]);

  const run = useCallback(async <T,>(action: () => Promise<T>, after?: (value: T) => void) => {
    setError(null);
    try {
      const value = await action();
      after?.(value);
      return value;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nutrition action failed.');
      return null;
    }
  }, []);

  useEffect(() => { void refresh(selectedDate); }, [refresh, selectedDate]);

  return {
    bootstrap,
    busy,
    error,
    selectedDate,
    setSelectedDate,
    refresh: () => refresh(selectedDate),
    search: (query: string, loggedAt: string) => run<NutritionSearchItem[]>(() => searchNutritionItems(query, loggedAt)),
    saveGoals: (input: NutritionGoalsInput) => run(() => saveNutritionGoals(input), () => void refresh(selectedDate)),
    saveBrandFood: (input: NutritionFoodInput) => run(() => createNutritionBrandFood(input), () => void refresh(selectedDate)),
    saveRecipe: (recipeId: string | null, input: NutritionRecipeInput) => run<NutritionRecipe>(() => recipeId ? updateNutritionRecipe(recipeId, input) : createNutritionRecipe(input), () => void refresh(selectedDate)),
    saveEntry: (entryId: string | null, input: NutritionDiaryEntryInput) => run<NutritionDiaryEntry>(() => entryId ? updateNutritionEntry(entryId, input) : createNutritionEntry(input), () => void refresh(selectedDate)),
    appendItem: (entryId: string, input: NutritionDiaryItemInput) => run(() => appendNutritionEntryItem(entryId, input), () => void refresh(selectedDate)),
    updateItem: (entryId: string, itemId: string, input: NutritionDiaryItemInput) => run(() => updateNutritionEntryItem(entryId, itemId, input), () => void refresh(selectedDate)),
    deleteEntry: (entryId: string) => run(() => deleteNutritionEntry(entryId), () => void refresh(selectedDate)),
    deleteItem: (entryId: string, itemId: string) => run(() => deleteNutritionEntryItem(entryId, itemId), () => void refresh(selectedDate)),
  };
}
