import { ChatMode } from './types';

interface ChatModeToggleProps {
  mode: ChatMode;
  onToggle: () => void;
}

export function ChatModeToggle({ mode, onToggle }: ChatModeToggleProps) {
  const isFlash = mode === 'flash';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFlash}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
        isFlash
          ? 'border-[#e2875e]/50 bg-[#3a241b] text-[#f6d5c8] hover:bg-[#472a1f]'
          : 'border-[#33332d] bg-[#272724] text-zinc-300 hover:bg-[#2e2e2a] hover:text-white'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isFlash ? 'bg-[#e2875e]' : 'bg-[#8db4d0]'}`} />
      <span>{isFlash ? 'Flash' : 'Thinking'}</span>
    </button>
  );
}
