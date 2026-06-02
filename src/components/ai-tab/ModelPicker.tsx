import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { modelOptions } from './data';

interface ModelPickerProps {
  currentModel: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (model: string) => void;
  onToggle: () => void;
}

export function ModelPicker({ currentModel, isOpen, onClose, onSelect, onToggle }: ModelPickerProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-lg border border-[#33332d] bg-[#272724] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:bg-[#2e2e2a] hover:text-zinc-200"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#e2875e]" />
        <span>{currentModel}</span>
        <ChevronDown size={11} className="stroke-[2.5]" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-full right-0 z-50 mb-1.5 flex w-52 flex-col rounded-xl border border-[#2f2f2b] bg-[#1a1a18] p-1.5 text-left shadow-xl"
            >
              <div className="mb-1 border-b border-[#292925] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Choose Model</div>
              {modelOptions.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => onSelect(model)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs ${
                    currentModel === model ? 'bg-zinc-800 font-medium text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  <span>{model}</span>
                  {currentModel === model && <span className="h-1.5 w-1.5 rounded-full bg-[#e2875e]" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
