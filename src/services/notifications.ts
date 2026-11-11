import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { markNotified, wasNotified } from '@/db/reminders';
import { planNotifications } from '@/domain/notification-plan';
import { formatInt } from '@/lib/format';
import { getSettings } from '@/stores/settings';
import { withExternalActivity } from '@/stores/ui';

import { loadUpcoming, vehicleLabel } from './upcoming';

const CHANNEL_ID = 'service-reminders';
let syncing: Promise<void> | null = null;
let pending = false;

export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de service',
      description: 'Avisos de mantenimientos próximos y kilometraje',
      // eslint-disable-next-line import/namespace -- re-exported enum the import plugin can't follow
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#0B63F6',
      vibrationPattern: [0, 200, 120, 200],
    });
  }
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const s = await Notifications.getPermissionsAsync();
  return s.granted ? 'granted' : s.canAskAgain ? 'undetermined' : 'denied';
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await withExternalActivity(() => Notifications.requestPermissionsAsync());
  return req.granted;
}

/**
 * Rebuilds every scheduled notification from the database (idempotent).
 * Called on launch and after any data change; concurrent calls are coalesced.
 */
export function syncNotifications(): Promise<void> {
  if (syncing) {
    pending = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        pending = false;
        await doSync();
      } while (pending);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function doSync(): Promise<void> {
  const prefs = getSettings().notifications;
  const status = await Notifications.getPermissionsAsync();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!status.granted) return;

  const { items, snapshots } = await loadUpcoming({ warnKm: prefs.warnKm });
  const vehicles = [...snapshots.values()].map((s) => ({
    id: s.vehicle.id,
    label: vehicleLabel(s.vehicle),
    lastReadingDate: s.lastReadingDate,
  }));
  const plan = planNotifications(items, vehicles, prefs, new Date());
  for (const n of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: n.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date, channelId: CHANNEL_ID },
    });
  }

  // Immediate distance alert: fires once per service target when a new odometer reading
  // leaves fewer than `warnKm` km to go (spec: "avisa cuando faltan menos de 1.000 km").
  if (prefs.kmAlert) {
    for (const it of items) {
      const rem = it.due.remainingKm;
      if (rem === null || rem > prefs.warnKm || it.due.dueKm === null) continue;
      const key = `km-now:${it.key}:${it.due.dueKm}`;
      if (await wasNotified(key)) continue;
      await markNotified(key);
      const snap = snapshots.get(it.vehicleId);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: rem <= 0 ? `Service vencido: ${it.title}` : `Faltan ${formatInt(rem)} km: ${it.title}`,
          body: `${snap ? vehicleLabel(snap.vehicle) : 'Tu auto'} · service a los ${formatInt(it.due.dueKm)} km`,
          data: { itemKey: it.key, vehicleId: it.vehicleId },
        },
        trigger: { channelId: CHANNEL_ID },
      });
    }
  }
}
