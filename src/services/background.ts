/**
 * Background work (Android WorkManager via expo-background-task).
 * This module is imported from the app entry (index.js) so the task is defined even when
 * Android wakes the app headless — no React tree is mounted in that case.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { initDatabase } from '@/db/open';
import { useSettings } from '@/stores/settings';

import { isBackupDue, runAutomaticBackup } from './backup';
import { syncNotifications } from './notifications';

export const BACKUP_TASK = 'careful-auto-backup';

TaskManager.defineTask(BACKUP_TASK, async () => {
  try {
    await initDatabase();
    await useSettings.getState().load();
    if (isBackupDue()) await runAutomaticBackup('schedule');
    // keep "estimated km" reminders fresh even if the app is not opened for weeks
    await syncNotifications();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** (Re)registers the periodic worker according to the backup settings. */
export async function configureBackgroundTask(): Promise<void> {
  const { enabled, intervalHours, folderUri } = useSettings.getState().backup;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  const registered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK);
  // Run at least daily for notification refresh; faster when backups require it.
  const minutes = enabled && folderUri ? Math.max(15, Math.min(intervalHours * 60, 24 * 60)) : 24 * 60;
  if (registered) await BackgroundTask.unregisterTaskAsync(BACKUP_TASK);
  await BackgroundTask.registerTaskAsync(BACKUP_TASK, { minimumInterval: minutes });
}
