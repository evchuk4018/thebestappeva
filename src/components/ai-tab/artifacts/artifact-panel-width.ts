import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

const STORAGE_KEY = 'ai-artifact-panel-width';
const DEFAULT_MIN_WIDTH = 560;
const MIN_RESIZABLE_WIDTH = 360;
const MIN_COMPACT_WIDTH = 320;
const MAX_WIDTH = 960;
const MIN_CHAT_WIDTH = 420;
const RESIZABLE_BREAKPOINT = DEFAULT_MIN_WIDTH + MIN_CHAT_WIDTH;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCompactWidth(workspaceWidth: number) {
  return clamp(workspaceWidth - MIN_CHAT_WIDTH, MIN_COMPACT_WIDTH, Math.min(MAX_WIDTH, workspaceWidth));
}

export function clampArtifactPanelWidth(workspaceWidth: number, desiredWidth: number) {
  const maxWidth = Math.min(MAX_WIDTH, Math.max(MIN_COMPACT_WIDTH, workspaceWidth - MIN_CHAT_WIDTH));
  const minWidth = workspaceWidth >= RESIZABLE_BREAKPOINT ? MIN_RESIZABLE_WIDTH : MIN_COMPACT_WIDTH;
  return clamp(desiredWidth, Math.min(minWidth, maxWidth), maxWidth);
}

export function getDefaultArtifactPanelWidth(workspaceWidth: number) {
  return clampArtifactPanelWidth(workspaceWidth, workspaceWidth * 0.5);
}

export function getArtifactPanelLayout(workspaceWidth: number, storedWidth: number | null) {
  const isResizable = workspaceWidth >= RESIZABLE_BREAKPOINT;
  const width = isResizable
    ? clampArtifactPanelWidth(workspaceWidth, storedWidth ?? getDefaultArtifactPanelWidth(workspaceWidth))
    : getCompactWidth(workspaceWidth);

  return { isResizable, width };
}

function readStoredWidth() {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  const parsed = storedValue ? Number.parseInt(storedValue, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

interface UseArtifactPanelWidthOptions {
  workspaceRef: RefObject<HTMLDivElement | null>;
}

export function useArtifactPanelWidth({ workspaceRef }: UseArtifactPanelWidthOptions) {
  const [panelWidth, setPanelWidth] = useState(() => getDefaultArtifactPanelWidth(1200));
  const [isResizable, setIsResizable] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const panelWidthRef = useRef(panelWidth);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncLayout = (requestedWidth: number | null) => {
      const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const layout = getArtifactPanelLayout(workspaceWidth, requestedWidth);
      setPanelWidth(layout.width);
      setIsResizable(layout.isResizable);
    };

    syncLayout(readStoredWidth());

    const handleWindowResize = () => {
      syncLayout(panelWidthRef.current);
    };

    window.addEventListener('resize', handleWindowResize);

    const observer = typeof ResizeObserver === 'undefined' || !workspaceRef.current
      ? null
      : new ResizeObserver(() => syncLayout(panelWidthRef.current));

    if (observer && workspaceRef.current) {
      observer.observe(workspaceRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      observer?.disconnect();
    };
  }, [workspaceRef]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, `${Math.round(panelWidth)}`);
  }, [panelWidth]);

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isResizable || typeof window === 'undefined') {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const rightEdge = workspaceRef.current?.getBoundingClientRect().right ?? window.innerWidth;
      setPanelWidth(clampArtifactPanelWidth(workspaceWidth, rightEdge - moveEvent.clientX));
    };

    const stopResizing = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
  }

  return {
    isResizable,
    isResizing,
    onResizePointerDown,
    panelWidth,
  };
}
