import { create } from 'zustand';

import { getAllSettings, setSetting } from '@/db/settings';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/domain/notification-plan';

export type ThemePreference = 'system' | 'light' | 'dark';
export type SecurityMode = 'none' | 'pin' | 'device';
export type AiProviderPreference = 'auto' | 'gemini' | 'local';

export interface BackupPrefs {
  /** Automatic periodic backups to the chosen folder. */
  enabled: boolean;
  /** Between 1 hour and 1 week (spec). */
  intervalHours: number;
  /** Also back up a few seconds after every change. */
  onEveryChange: boolean;
  /** Android SAF directory URI chosen by the user. */
  folderUri: string | null;
  folderLabel: string | null;
  /** Backup files kept in the folder (older ones are pruned). */
  keep: number;
  lastBackupAt: string | null;
  lastError: string | null;
}

export interface AiPrefs {
  provider: AiProviderPreference;
  model: string;
  /** The API key itself lives in SecureStore; this only mirrors whether one is saved. */
  hasKey: boolean;
}

export interface SettingsData {
  theme: ThemePreference;
  securityMode: SecurityMode;
  notifications: NotificationPrefs;
  backup: BackupPrefs;
  ai: AiPrefs;
  lastVehicleId: string | null;
}

export const BACKUP_INTERVALS_HOURS = [1, 3, 6, 12, 24, 72, 168] as const;

export const DEFAULT_SETTINGS: SettingsData = {
  theme: 'system',
  securityMode: 'none',
  notifications: DEFAULT_NOTIFICATION_PREFS,
  backup: {
    enabled: false,
    intervalHours: 24,
    onEveryChange: false,
    folderUri: null,
    folderLabel: null,
    keep: 10,
    lastBackupAt: null,
    lastError: null,
  },
  ai: { provider: 'auto', model: 'gemini-flash-latest', hasKey: false },
  lastVehicleId: null,
};

interface SettingsStore extends SettingsData {
  loaded: boolean;
  load(): Promise<void>;
  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): Promise<void>;
  patch<K extends 'notifications' | 'backup' | 'ai'>(key: K, value: Partial<SettingsData[K]>): Promise<void>;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const stored = await getAllSettings();
    const merged: SettingsData = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsData)[]) {
      if (!(key in stored)) continue;
      const def = DEFAULT_SETTINGS[key];
      const value = stored[key];
      (merged as unknown as Record<string, unknown>)[key] =
        def && typeof def === 'object' && value && typeof value === 'object' ? { ...def, ...value } : value;
    }
    set({ ...merged, loaded: true });
  },
  async set(key, value) {
    set({ [key]: value } as Partial<SettingsStore>);
    await setSetting(key, value);
  },
  async patch(key, value) {
    const next = { ...get()[key], ...value };
    set({ [key]: next } as Partial<SettingsStore>);
    await setSetting(key, next);
  },
}));

export function getSettings(): SettingsData {
  return useSettings.getState();
}
