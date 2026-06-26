import { Camera, Search, Soup } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface NutritionQuickActionMenuProps {
  open: boolean;
  onClose: () => void;
  onLogFood: () => void;
  onAiFoodLog: () => void;
  onOpenRecipes: () => void;
}

export function NutritionQuickActionMenu({
  open,
  onClose,
  onLogFood,
  onAiFoodLog,
  onOpenRecipes,
}: NutritionQuickActionMenuProps) {
  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-30 bg-zinc-600/80 px-5 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-5 bottom-24 mx-auto flex max-w-[390px] flex-col gap-3"
            exit={{ opacity: 0, y: 24 }}
            initial={{ opacity: 0, y: 34 }}
            onClick={(event) => event.stopPropagation()}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <button onClick={() => run(onLogFood)} className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-sm font-semibold text-white shadow-xl shadow-black/25">
              <Search size={18} className="text-emerald-300" /> Log Food
            </button>
            <button onClick={() => run(onAiFoodLog)} className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-sm font-semibold text-white shadow-xl shadow-black/25">
              <Camera size={18} className="text-emerald-300" /> AI Food Log
            </button>
            <button onClick={() => run(onOpenRecipes)} className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left text-sm font-semibold text-white shadow-xl shadow-black/25">
              <Soup size={18} className="text-emerald-300" /> Recipes
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
