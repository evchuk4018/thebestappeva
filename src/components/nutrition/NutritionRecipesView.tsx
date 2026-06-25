import { useState } from 'react';
import type { NutritionRecipe } from '../../../shared/nutrition-contract';

export function NutritionRecipesView({
  recipes,
  onCreate,
  onEdit,
  onLog,
}: {
  recipes: NutritionRecipe[];
  onCreate: () => void;
  onEdit: (recipe: NutritionRecipe) => void;
  onLog: (recipe: NutritionRecipe) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(recipes[0]?.id ?? null);
  const selected = recipes.find((recipe) => recipe.id === selectedId) ?? null;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <section className="space-y-4">
        <button onClick={onCreate} className="w-full rounded-[28px] border border-emerald-500/35 bg-emerald-500/10 p-5 text-left transition hover:bg-emerald-500/15">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Custom Recipe</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Build a quick-log recipe</h2>
          <p className="mt-2 text-sm text-zinc-300">Combine existing foods, store servings and total weight, then log the recipe in one tap.</p>
        </button>
        {recipes.map((recipe) => (
          <button key={recipe.id} onClick={() => setSelectedId(recipe.id)} className={`w-full rounded-[28px] border p-4 text-left transition ${selectedId === recipe.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-600'}`}>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{Math.round(recipe.servings)} servings</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{recipe.name}</h3>
            <p className="mt-2 text-sm text-zinc-300">{Math.round(recipe.nutritionPerServing.calories)} cals per serving</p>
          </button>
        ))}
      </section>
      <section className="rounded-[32px] border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/30">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Recipe Detail</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">{selected.name}</h2>
                <p className="mt-3 text-sm text-zinc-300">{selected.note || `${selected.ingredients.length} ingredients`}</p>
              </div>
              <button onClick={() => onEdit(selected)} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white">Edit</button>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Servings</p><p className="mt-2 text-2xl font-bold text-white">{Math.round(selected.servings)}</p></div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Weight</p><p className="mt-2 text-2xl font-bold text-white">{Math.round(selected.totalWeightG)}g</p></div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Calories</p><p className="mt-2 text-2xl font-bold text-white">{Math.round(selected.nutritionPerServing.calories)}</p></div>
            </div>
            <div className="mt-6 space-y-3">
              {selected.ingredients.map((ingredient) => (
                <div key={ingredient.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#111315] px-4 py-3 text-sm">
                  <span className="text-zinc-100">{ingredient.foodName}</span>
                  <span className="text-zinc-400">{Math.round(ingredient.amountG)} g</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => onLog(selected)} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">Quick Log Recipe</button>
            </div>
          </>
        ) : (
          <div className="grid h-full min-h-[240px] place-items-center text-center text-sm text-zinc-400">No recipes saved yet.</div>
        )}
      </section>
    </div>
  );
}
