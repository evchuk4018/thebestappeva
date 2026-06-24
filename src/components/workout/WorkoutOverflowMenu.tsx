import { MoreHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface WorkoutOverflowMenuItem {
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}

interface WorkoutOverflowMenuProps {
  ariaLabel: string;
  items: WorkoutOverflowMenuItem[];
  forceOpen?: boolean;
}

export function WorkoutOverflowMenu({ ariaLabel, items, forceOpen = false }: WorkoutOverflowMenuProps) {
  const [open, setOpen] = useState(forceOpen);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(forceOpen);
  }, [forceOpen]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const menuItems = useMemo(() => items.map((item) => (
    <button
      key={item.label}
      onClick={() => {
        item.onClick();
        setOpen(false);
      }}
      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${item.tone === 'danger' ? 'text-red-200 hover:bg-red-950/60' : 'text-zinc-100 hover:bg-zinc-800'}`}
    >
      {item.label}
    </button>
  )), [items]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className="grid h-9 w-9 place-items-center rounded-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        aria-label={ariaLabel}
      >
        <MoreHorizontal size={18} />
      </button>
      {open ? <div className="absolute right-0 top-11 z-20 min-w-44 rounded-2xl border border-zinc-800 bg-[#15181d] p-2 shadow-2xl shadow-black/45">{menuItems}</div> : null}
    </div>
  );
}
