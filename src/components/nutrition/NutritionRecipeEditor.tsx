import { useState } from 'react';
import type { NutritionRecipe, NutritionRecipeInput, NutritionSearchItem } from '../../../shared/nutrition-contract';

interface DraftIngredient {
  foodId: string;
  name: string;
  amountG: string;
}

function initialIngredients(recipe: NutritionRecipe | null): DraftIngredient[] {
  return recipe?.ingredients.map((ingredient) => ({ foodId: ingredient.foodId, name: ingredient.foodName, amountG: String(ingredient.amountG) })) ?? [];
}

export function NutritionRecipeEditor({
  initialRecipe,
  onClose,
  onSave,
  onSearchFoods,
}: {
  initialRecipe: NutritionRecipe | null;
  onClose: () => void;
  onSave: (recipeId: string | null, input: NutritionRecipeInput) => void;
  onSearchFoods: (query: string) => Promise<NutritionSearchItem[] | null>;
}) {
  const [name, setName] = useState(initialRecipe?.name ?? '');
  const [note, setNote] = useState(initialRecipe?.note ?? '');
  const [servings, setServings] = useState(String(initialRecipe?.servings ?? 4));
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(initialIngredients(initialRecipe));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NutritionSearchItem[]>([]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-3 py-4 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(initialRecipe?.id ?? null, {
            name,
            note,
            servings: Number(servings),
            ingredients: ingredients.map((ingredient, index) => ({ foodId: ingredient.foodId, amountG: Number(ingredient.amountG), orderIndex: index })),
          });
        }}
        className="mx-auto flex h-full w-full max-w-3xl flex-col rounded-[30px] border border-zinc-800 bg-[#111214] shadow-2xl shadow-black/50"
      >
        <div className="border-b border-zinc-800 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Recipe Builder</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{initialRecipe ? 'Edit recipe' : 'New recipe'}</h2>
            </div>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-400 hover:text-white">Close</button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
            <label className="text-sm text-zinc-300">Recipe name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
            <label className="text-sm text-zinc-300">Servings<input value={servings} onChange={(event) => setServings(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
          </div>
          <label className="mt-3 block text-sm text-zinc-300">Note<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-[84px] w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none" /></label>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="min-h-0 overflow-y-auto">
            <div className="flex items-center gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods for ingredients" className="flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" onClick={async () => setResults((await onSearchFoods(query))?.filter((item) => item.itemType === 'food') ?? [])} className="rounded-full bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">Find</button>
            </div>
            <div className="mt-4 space-y-3">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIngredients((current) => [...current, { foodId: item.id, name: item.brandName ? `${item.brandName} ${item.name}` : item.name, amountG: String(Math.round(item.defaultAmountG)) }]);
                    setQuery('');
                    setResults([]);
                  }}
                  className="w-full rounded-[22px] border border-zinc-800 bg-zinc-900/70 p-3 text-left hover:border-zinc-600"
                >
                  <p className="text-sm font-semibold text-sky-300">{item.name}</p>
                  <p className="mt-1 text-xs text-zinc-400">{item.brandName ? `${item.brandName} · ` : ''}{item.defaultServingLabel ?? `${Math.round(item.defaultAmountG)} g`}</p>
                </button>
              ))}
            </div>
          </section>
          <section className="min-h-0 overflow-y-auto rounded-[28px] border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Ingredients</h3>
              <span className="text-sm text-zinc-500">{ingredients.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {ingredients.map((ingredient, index) => (
                <div key={`${ingredient.foodId}-${index}`} className="rounded-[22px] border border-zinc-800 bg-[#111315] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{ingredient.name}</p>
                    <button type="button" onClick={() => setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs text-red-300 hover:text-red-200">Remove</button>
                  </div>
                  <label className="mt-3 block text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Grams
                    <input value={ingredient.amountG} onChange={(event) => setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amountG: event.target.value } : item))} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" />
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="border-t border-zinc-800 p-5">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Cancel</button>
            <button type="submit" className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">Save Recipe</button>
          </div>
        </div>
      </form>
    </div>
  );
}
