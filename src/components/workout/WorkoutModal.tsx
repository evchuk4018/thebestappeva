import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface WorkoutModalProps {
  children: ReactNode;
  title: string;
  description?: string;
  onClose: () => void;
}

export function WorkoutModal({ children, title, description, onClose }: WorkoutModalProps) {
  return (
    <div className="fixed inset-x-0 top-0 bottom-24 z-30 flex items-start justify-center bg-zinc-950/70 px-4 py-4 backdrop-blur-sm md:px-6 md:py-6">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-zinc-800 bg-[#0f1115] shadow-2xl shadow-black/45">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-800 text-zinc-300 transition hover:bg-zinc-800" aria-label="Close popup">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
