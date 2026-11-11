import { create } from 'zustand';

import { getAllSettings, setSetting } from '@/db/settings';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/domain/notification-plan';

export type ThemePreference = 'system' | 'light' | 'dark';
export type SecurityMode = 'none' | 'pin' | 'device';
export type AiProviderPreference = 'auto' | 'gemini' | 'local';

/**
 * Backups are always automatic for every configured destination: after each change (debounced)
 * and once a day after midnight. Local destination = this folder; cloud = DrivePrefs.
 */
export interface BackupPrefs {
  /** Android SAF directory URI chosen by the user (null = no local backups). */
  folderUri: string | null;
  folderLabel: string | null;
  lastBackupAt: string | null;
  lastError: string | null;
}

/** Direct sync with the user's Google Drive (folder "Careful Respaldos", scope drive.file). */
export interface DrivePrefs {
  /** Authorized Google account; null = not connected. Connected means automatic uploads. */
  email: string | null;
  name: string | null;
  /** Never spend mobile data on automatic uploads. */
  wifiOnly: boolean;
  lastAt: string | null;
  lastError: string | null;
  /** Data changed while uploads were blocked (no Wi-Fi, offline, error): upload at the next chance. */
  pending: boolean;
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
  drive: DrivePrefs;
  ai: AiPrefs;
  lastVehicleId: string | null;
}

export const DEFAULT_SETTINGS: SettingsData = {
  theme: 'system',
  securityMode: 'none',
  notifications: DEFAULT_NOTIFICATION_PREFS,
  backup: { folderUri: null, folderLabel: null, lastBackupAt: null, lastError: null },
  drive: { email: null, name: null, wifiOnly: true, lastAt: null, lastError: null, pending: false },
  ai: { provider: 'auto', model: 'gemini-flash-latest', hasKey: false },
  lastVehicleId: null,
};

interface SettingsStore extends SettingsData {
  loaded: boolean;
  load(): Promise<void>;
  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): Promise<void>;
  patch<K extends 'notifications' | 'backup' | 'drive' | 'ai'>(key: K, value: Partial<SettingsData[K]>): Promise<void>;
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
