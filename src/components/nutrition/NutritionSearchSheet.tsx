import type { NutritionSearchItem } from '../../../shared/nutrition-contract';

export function NutritionSearchSheet({
  query,
  results,
  onClose,
  onCreateFood,
  onPick,
  onQueryChange,
}: {
  query: string;
  results: NutritionSearchItem[];
  onClose: () => void;
  onCreateFood: () => void;
  onPick: (item: NutritionSearchItem) => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 px-3 py-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col rounded-[30px] border border-zinc-800 bg-[#101111] shadow-2xl shadow-black/50">
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Enter food name or brand"
              className="flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button onClick={onClose} className="text-sm font-semibold text-zinc-400 hover:text-white">Close</button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">One fuzzy search list ranked by text match, recent logging, frequency, and time of day.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {results.map((item) => (
              <button key={`${item.itemType}:${item.id}`} onClick={() => onPick(item)} className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-zinc-800 bg-zinc-900/70 p-4 text-left transition hover:border-zinc-600 hover:bg-zinc-900">
                <div>
                  <p className="text-sm font-semibold text-sky-300">{item.name}</p>
                  <p className="mt-1 text-sm text-zinc-300">{item.brandName ? `${item.brandName} · ${item.subtitle}` : item.subtitle}</p>
                  <p className="mt-1 text-xs text-zinc-500">{Math.round(item.nutrition.calories)} cals / {item.defaultServingLabel ?? `${Math.round(item.defaultAmountG)} g`}</p>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <p>{item.itemType === 'recipe' ? 'Recipe' : 'Food'}</p>
                  <p className="mt-1">score {item.score.toFixed(1)}</p>
                </div>
              </button>
            ))}
          </div>
          {!results.length ? (
            <button onClick={onCreateFood} className="mt-4 w-full rounded-[24px] border border-dashed border-emerald-500/50 bg-emerald-500/10 px-4 py-5 text-left transition hover:bg-emerald-500/15">
              <p className="text-sm font-semibold text-emerald-300">Add new food</p>
              <p className="mt-2 text-sm text-zinc-300">No close match found. Create a branded food manually and keep it in your local database.</p>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
