import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Wordmark } from '@/components/brand';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Card, ListRow, Segmented } from '@/components/ui/primitives';
import { getDb, notifyDataChanged } from '@/db/connection';
import { TABLES } from '@/db/migrations';
import { listVehicles, setVehicleArchived } from '@/db/vehicles';
import { useQuery } from '@/hooks/useQuery';
import { formatMoment } from '@/lib/dates';
import { listPhotoFiles } from '@/services/photos';
import { useSettings, type BackupPrefs, type DrivePrefs, type ThemePreference } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const theme = useSettings((s) => s.theme);
  const securityMode = useSettings((s) => s.securityMode);
  const backup = useSettings((s) => s.backup);
  const drive = useSettings((s) => s.drive);
  const notifications = useSettings((s) => s.notifications);
  const ai = useSettings((s) => s.ai);
  const { data: archived } = useQuery(async () => (await listVehicles({ includeArchived: true })).filter((v) => v.archivedAt), []);

  const wipe = () =>
    Alert.alert('Borrar todos los datos', 'Se eliminarán vehículos, registros, recordatorios y fotos de este teléfono. Hacé un respaldo antes si querés conservarlos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar todo',
        style: 'destructive',
        onPress: async () => {
          const db = getDb();
          await db.withTransactionAsync(async () => {
            for (const t of [...TABLES].reverse()) if (t !== 'settings') await db.runAsync(`DELETE FROM ${t}`);
          });
          for (const f of listPhotoFiles()) f.delete();
          notifyDataChanged();
          toast('Datos borrados');
        },
      },
    ]);

  return (
    <Screen tabBar header={<Header large title="Ajustes" />}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Apariencia
        </AppText>
        <Segmented<ThemePreference>
          value={theme}
          onChange={(v) => void useSettings.getState().set('theme', v)}
          options={[
            { value: 'system', label: 'Sistema', icon: 'cellphone' },
            { value: 'light', label: 'Claro', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Oscuro', icon: 'weather-night' },
          ]}
        />
      </View>

      <Card padded={false}>
        <ListRow
          icon="shield-lock"
          title="Seguridad"
          subtitle={securityMode === 'none' ? 'Sin bloqueo' : securityMode === 'pin' ? 'PIN de Careful' : 'Desbloqueo del teléfono'}
          onPress={() => router.push('/settings/security')}
        />
        <ListRow
          icon="cloud-upload"
          iconColor="#14C895"
          title="Respaldo y sincronización"
          subtitle={backupSummary(backup, drive)}
          onPress={() => router.push('/settings/backup')}
        />
        <ListRow
          icon="bell-ring"
          iconColor="#E8930C"
          title="Notificaciones"
          subtitle={`Siempre activas · ${String(notifications.hour).padStart(2, '0')}:${String(notifications.minute).padStart(2, '0')} h`}
          onPress={() => router.push('/settings/notifications')}
        />
        <ListRow
          icon="star-four-points"
          iconColor="#7C5CFF"
          title="Inteligencia artificial"
          subtitle={ai.provider === 'local' ? 'En el teléfono' : ai.hasKey ? 'Gemini conectado' : 'En el teléfono · Gemini sin configurar'}
          onPress={() => router.push('/settings/ai')}
          last
        />
      </Card>

      {archived?.length ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="overline" tone="muted">
            Vehículos archivados
          </AppText>
          <Card padded={false}>
            {archived.map((v, i) => (
              <ListRow
                key={v.id}
                icon="archive-outline"
                title={`${v.brand} ${v.model}`}
                subtitle="Tocá para restaurar al garage"
                last={i === archived.length - 1}
                onPress={async () => {
                  await setVehicleArchived(v.id, false);
                  toast('Vehículo restaurado');
                }}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <Card padded={false}>
        <ListRow icon="information-outline" title="Acerca de Careful" subtitle={`Versión ${Constants.expoConfig?.version ?? '1.0.0'}`} onPress={() => router.push('/settings/about')} />
        <ListRow icon="delete-outline" title="Borrar todos los datos" danger last onPress={wipe} />
      </Card>

      <View style={{ alignItems: 'center', gap: 6, paddingTop: spacing.md }}>
        <Wordmark height={24} />
        <AppText variant="caption" tone="subtle">
          Tu auto, toda su historia en un solo lugar.
        </AppText>
      </View>
    </Screen>
  );
}

function backupSummary(backup: BackupPrefs, drive: DrivePrefs): string {
  const last = (iso: string | null) => (iso ? `último ${formatMoment(iso)}` : 'pendiente');
  if (drive.email && drive.enabled) return `Google Drive · ${drive.pending ? 'cambios pendientes' : last(drive.lastAt)}`;
  if (backup.enabled && backup.folderUri) return `Carpeta · ${last(backup.lastBackupAt)}`;
  if (drive.email) return 'Google Drive conectado · manual';
  return 'Manual';
}
