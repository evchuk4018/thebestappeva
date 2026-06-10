import { ChevronDown, Download, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatModelMeta } from './helpers';
import { OllamaModel } from './types';

interface ModelPickerProps {
  currentModel: string | null;
  disabled?: boolean;
  isLoading: boolean;
  isOpen: boolean;
  models: OllamaModel[];
  onAddModels: () => void;
  onClose: () => void;
  onSelect: (model: string) => void;
  onToggle: () => void;
}

export function ModelPicker({ currentModel, disabled = false, isLoading, isOpen, models, onAddModels, onClose, onSelect, onToggle }: ModelPickerProps) {
  const buttonLabel = currentModel ?? (isLoading ? 'Detecting models...' : 'No local models');

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-lg border border-[#33332d] bg-[#272724] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-[#2e2e2a] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? <LoaderCircle size={11} className="animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-[#e2875e]" />}
        <span className="max-w-[190px] truncate">{buttonLabel}</span>
        <ChevronDown size={11} className="stroke-[2.5]" />
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-full right-0 z-50 mb-1.5 flex w-72 flex-col rounded-xl border border-[#2f2f2b] bg-[#1a1a18] p-1.5 text-left shadow-xl"
            >
              <div className="mb-1 border-b border-[#292925] px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Installed Models</div>
              {models.map((model) => {
                const meta = formatModelMeta(model);
                return (
                  <button
                    key={model.name}
                    type="button"
                    onClick={() => onSelect(model.name)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left ${
                      currentModel === model.name ? 'bg-zinc-800 font-medium text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs">{model.name}</div>
                      {meta && <div className="truncate text-[10px] text-zinc-500">{meta}</div>}
                    </div>
                    {currentModel === model.name && <span className="h-1.5 w-1.5 rounded-full bg-[#e2875e]" />}
                  </button>
                );
              })}
              {!models.length && (
                <div className="rounded-lg px-2 py-3 text-xs text-zinc-500">
                  {isLoading ? 'Checking your local Ollama runtime...' : 'No installed models found.'}
                </div>
              )}
              <button
                type="button"
                onClick={onAddModels}
                className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-[#33332d] bg-[#232320] px-3 py-2 text-xs font-medium text-[#efeae4] transition hover:border-[#e2875e]/40 hover:text-white"
              >
                <Download size={13} />
                <span>Add models</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
