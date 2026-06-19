import type { SpawnOptions } from 'node:child_process';

export function withHiddenWindows<T extends SpawnOptions>(options: T): T & { windowsHide: true } {
  return {
    ...options,
    windowsHide: true,
  };
}
