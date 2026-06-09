import type { PointerEvent as ReactPointerEvent } from 'react';

interface ArtifactResizeHandleProps {
  isResizable: boolean;
  isResizing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function ArtifactResizeHandle({ isResizable, isResizing, onPointerDown }: ArtifactResizeHandleProps) {
  if (!isResizable) {
    return null;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize artifact panel"
      onPointerDown={onPointerDown}
      className="absolute inset-y-0 left-0 z-20 hidden w-4 -translate-x-1/2 cursor-col-resize md:flex md:items-center md:justify-center"
    >
      <div className={`h-16 w-[3px] rounded-full transition ${isResizing ? 'bg-[#8db4d0]' : 'bg-[#243443] hover:bg-[#40607d]'}`} />
    </div>
  );
}
