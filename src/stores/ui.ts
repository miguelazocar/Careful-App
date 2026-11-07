import { create } from 'zustand';

import { onDataChanged } from '@/db/connection';

/* ------------------------------- Data version ------------------------------ */

interface DataVersionStore {
  version: number;
  bump(): void;
}

/** Incremented after every DB write — queries depend on it to refresh. */
export const useDataVersion = create<DataVersionStore>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

onDataChanged(() => useDataVersion.getState().bump());

/* ---------------------------------- Lock ---------------------------------- */

interface LockStore {
  locked: boolean;
  /** >0 while a system activity we launched (camera, picker, share, auth) is in front. */
  externalActivity: number;
  lock(): void;
  unlock(): void;
  beginExternal(): void;
  endExternal(): void;
}

export const useLock = create<LockStore>((set) => ({
  locked: false,
  externalActivity: 0,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
  beginExternal: () => set((s) => ({ externalActivity: s.externalActivity + 1 })),
  endExternal: () => set((s) => ({ externalActivity: Math.max(0, s.externalActivity - 1) })),
}));

/**
 * Wraps calls that open another Android activity (camera, gallery, share sheet, file picker,
 * biometric prompt). Without this, "lock when leaving the app" would lock the user out every time
 * they take a photo — a logic gap in the original spec.
 */
export async function withExternalActivity<T>(fn: () => Promise<T>): Promise<T> {
  useLock.getState().beginExternal();
  try {
    return await fn();
  } finally {
    // give AppState time to report "active" before re-arming the lock
    setTimeout(() => useLock.getState().endExternal(), 800);
  }
}

/* ---------------------------------- Toast --------------------------------- */

export type ToastTone = 'success' | 'error' | 'info';

interface ToastStore {
  message: string | null;
  tone: ToastTone;
  key: number;
  show(message: string, tone?: ToastTone): void;
  hide(): void;
}

export const useToast = create<ToastStore>((set) => ({
  message: null,
  tone: 'success',
  key: 0,
  show: (message, tone = 'success') => set((s) => ({ message, tone, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

export const toast = (message: string, tone: ToastTone = 'success') => useToast.getState().show(message, tone);
