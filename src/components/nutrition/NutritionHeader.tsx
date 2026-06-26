import { CalendarDays, ChevronLeft, ChevronRight, Menu, MoreVertical, Plus, Search, Soup } from 'lucide-react';
import { useState } from 'react';

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
  const [menuOpen, setMenuOpen] = useState(false);

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <header className="relative border-b border-[#252525] bg-[#1a1a1a] px-3 py-3">
      <div className="mx-auto flex max-w-[390px] items-center justify-between gap-2">
        <button onClick={() => setMenuOpen((open) => !open)} className="rounded-full p-2 text-zinc-100 hover:bg-zinc-800" aria-label="Open nutrition menu">
          <Menu size={22} />
        </button>
        <button onClick={onPreviousDay} className="rounded-full p-2 text-zinc-100 hover:bg-zinc-800" aria-label="Previous day">
          <ChevronLeft size={24} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-white">
          <CalendarDays size={19} />
          <h1 className="truncate text-base font-bold">{dateLabel}</h1>
        </div>
        <button onClick={onNextDay} className="rounded-full p-2 text-zinc-100 hover:bg-zinc-800" aria-label="Next day">
          <ChevronRight size={24} />
        </button>
        <button onClick={() => setMenuOpen((open) => !open)} className="rounded-full p-2 text-zinc-100 hover:bg-zinc-800" aria-label="More nutrition actions">
          <MoreVertical size={22} />
        </button>
      </div>

      {menuOpen ? (
        <div className="absolute right-3 top-[58px] z-30 w-48 overflow-hidden rounded-lg border border-zinc-700 bg-[#232323] py-1 shadow-2xl shadow-black/50">
          <button onClick={() => run(onSearch)} className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-zinc-100 hover:bg-zinc-800">
            <Search size={16} /> Search foods
          </button>
          <button onClick={() => run(onAddFood)} className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-zinc-100 hover:bg-zinc-800">
            <Plus size={16} /> Add food
          </button>
          <button onClick={() => run(onOpenRecipes)} className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-zinc-100 hover:bg-zinc-800">
            <Soup size={16} /> Recipes
          </button>
        </div>
      ) : null}
    </header>
  );
}
