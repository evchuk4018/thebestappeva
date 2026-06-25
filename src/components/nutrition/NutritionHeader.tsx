import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';

export function NutritionHeader({
  dateLabel,
  onAddFood,
  onNextDay,
  onOpenRecipes,
  onPreviousDay,
  onSearch,
}: {
  dateLabel: string;
  onAddFood: () => void;
  onNextDay: () => void;
  onOpenRecipes: () => void;
  onPreviousDay: () => void;
  onSearch: () => void;
}) {
  return (
    <header className="border-b border-zinc-800 bg-[#101313] px-4 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">Nutrition</p>
          <div className="mt-2 flex items-center gap-2 text-white">
            <button onClick={onPreviousDay} className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:border-zinc-500 hover:text-white"><ChevronLeft size={18} /></button>
            <h1 className="text-lg font-semibold">{dateLabel}</h1>
            <button onClick={onNextDay} className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:border-zinc-500 hover:text-white"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSearch} className="rounded-full border border-zinc-700 p-3 text-zinc-200 hover:border-zinc-500 hover:text-white"><Search size={18} /></button>
          <button onClick={onOpenRecipes} className="rounded-full border border-zinc-700 p-3 text-zinc-200 hover:border-zinc-500 hover:text-white">R</button>
          <button onClick={onAddFood} className="rounded-full bg-emerald-500 p-3 text-zinc-950 shadow-lg shadow-emerald-950/40 hover:bg-emerald-400"><Plus size={18} /></button>
        </div>
      </div>
    </header>
  );
}
