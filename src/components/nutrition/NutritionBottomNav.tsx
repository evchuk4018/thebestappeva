import { BarChart3, Home, Plus } from 'lucide-react';
import { useState } from 'react';
import { NutritionQuickActionMenu } from './NutritionQuickActionMenu';

export function NutritionBottomNav({
  active,
  onDashboard,
  onHome,
  onAiFoodLog,
  onLogFood,
  onOpenRecipes,
}: {
  active: 'dashboard' | 'recipes';
  onDashboard: () => void;
  onHome: () => void;
  onAiFoodLog: () => void;
  onLogFood: () => void;
  onOpenRecipes: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const itemClass = 'flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs transition';

  return (
    <>
      <NutritionQuickActionMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAiFoodLog={onAiFoodLog}
        onLogFood={onLogFood}
        onOpenRecipes={onOpenRecipes}
      />
      <nav className="sticky bottom-0 z-40 border-t border-[#2a2a2a] bg-[#202123] px-3 pb-3 pt-2">
        <div className="mx-auto flex max-w-[390px] items-center gap-2">
          <button onClick={onDashboard} className={`${itemClass} ${active === 'dashboard' ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>
            <span className={`rounded-md p-1 ${active === 'dashboard' ? 'bg-zinc-600' : ''}`}><BarChart3 size={20} /></span>
            Dashboard
          </button>
          <button onClick={() => setMenuOpen((open) => !open)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-400" aria-label="Open nutrition quick actions">
            <Plus size={26} />
          </button>
          <button onClick={onHome} className={`${itemClass} text-zinc-500 hover:text-zinc-200`}>
            <span className="rounded-md p-1"><Home size={20} /></span>
            Home
          </button>
        </div>
      </nav>
    </>
  );
}
