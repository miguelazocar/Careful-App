import * as Crypto from 'expo-crypto';

import { onDataChanged } from '@/db/connection';
import { initDatabase } from '@/db/open';
import { configureIdGenerator } from '@/lib/id';
import { useSettings } from '@/stores/settings';
import { useLock } from '@/stores/ui';

import { getGeminiKey } from './ai/gemini';
import { runAutomaticBackup, startChangeBackups } from './backup';
import { configureBackgroundTask } from './background';
import { configureNotifications, syncNotifications } from './notifications';
import { getDeviceAuthSupport, getPinLength } from './security';

let started = false;
let notifTimer: ReturnType<typeof setTimeout> | null = null;

export async function bootstrap(): Promise<void> {
  configureIdGenerator(Crypto.randomUUID);
  await initDatabase();
  const settings = useSettings.getState();
  await settings.load();

  // Self-heal device-bound settings (e.g. after Android restored the database on a new phone,
  // the PIN in the Keystore does not travel — never lock the user out).
  const s = useSettings.getState();
  if (s.securityMode === 'pin' && (await getPinLength()) === null) await s.set('securityMode', 'none');
  // same if the phone's own screen lock was removed: "Desbloqueo del teléfono" could never succeed
  if (s.securityMode === 'device' && !(await getDeviceAuthSupport().catch(() => ({ available: true }))).available) await s.set('securityMode', 'none');
  const hasKey = !!(await getGeminiKey());
  if (s.ai.hasKey !== hasKey) await s.patch('ai', { hasKey });

  if (useSettings.getState().securityMode !== 'none') useLock.getState().lock();

  if (started) return;
  started = true;
  configureNotifications();
  startChangeBackups();
  // keep scheduled notifications in sync with the data (debounced)
  onDataChanged(() => {
    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => void syncNotifications().catch(() => undefined), 1200);
  });
  // non-blocking housekeeping
  setTimeout(() => {
    void syncNotifications().catch(() => undefined);
    void configureBackgroundTask().catch(() => undefined);
    void runAutomaticBackup('launch');
  }, 1500);
}
