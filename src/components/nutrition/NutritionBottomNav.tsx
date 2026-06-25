export function NutritionBottomNav({
  active,
  onChange,
}: {
  active: 'dashboard' | 'recipes';
  onChange: (value: 'dashboard' | 'recipes') => void;
}) {
  const itemClass = 'flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition';

  return (
    <nav className="sticky bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md gap-3 rounded-[28px] border border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-black/40">
        <button onClick={() => onChange('dashboard')} className={`${itemClass} ${active === 'dashboard' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}>
          Dashboard
        </button>
        <button onClick={() => onChange('recipes')} className={`${itemClass} ${active === 'recipes' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}>
          Recipes
        </button>
      </div>
    </nav>
  );
}
