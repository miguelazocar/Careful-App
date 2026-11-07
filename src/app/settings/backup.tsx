import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Icon, ListRow, SwitchRow } from '@/components/ui/primitives';
import { formatDay, relativeDays } from '@/lib/dates';
import { backupToFolder, pickBackupFolder, readBackupFile, restoreBackup, shareBackup, type RestorePreview } from '@/services/backup';
import { configureBackgroundTask } from '@/services/background';
import { syncNotifications } from '@/services/notifications';
import { BACKUP_INTERVALS_HOURS, useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const intervalLabel = (h: number) => (h < 24 ? `${h} h` : h === 24 ? '1 día' : h === 168 ? '1 semana' : `${h / 24} días`);

export default function BackupScreen() {
  const { colors } = useTheme();
  const backup = useSettings((s) => s.backup);
  const [busy, setBusy] = useState<null | 'now' | 'share' | 'restore'>(null);

  const patch = async (p: Partial<typeof backup>) => {
    await useSettings.getState().patch('backup', p);
    void configureBackgroundTask().catch(() => undefined);
  };

  const chooseFolder = async () => {
    try {
      const folder = await pickBackupFolder();
      if (!folder) return;
      await patch({ folderUri: folder.uri, folderLabel: folder.label, enabled: true, lastError: null });
      toast('Carpeta configurada');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo elegir la carpeta', 'error');
    }
  };

  const runNow = async () => {
    setBusy('now');
    try {
      const r = await backupToFolder();
      toast(`Respaldo guardado (${Math.max(1, Math.round(r.size / 1024))} KB)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await useSettings.getState().patch('backup', { lastError: msg });
      toast(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    try {
      await shareBackup();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo crear el respaldo', 'error');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    let preview: RestorePreview | null = null;
    try {
      setBusy('restore');
      preview = await readBackupFile();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivo inválido', 'error');
    } finally {
      setBusy(null);
    }
    if (!preview) return;
    const p = preview;
    Alert.alert(
      'Restaurar respaldo',
      `Respaldo del ${formatDay(p.exportedAt.slice(0, 10))}: ${p.vehicles} vehículos y ${p.records} registros.\n\nReemplaza TODOS los datos actuales de este teléfono.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            setBusy('restore');
            try {
              await restoreBackup(p);
              void syncNotifications();
              toast('Datos restaurados');
            } catch (e) {
              toast(e instanceof Error ? e.message : 'No se pudo restaurar', 'error');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen header={<Header back title="Respaldo y sincronización" />}>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Icon name="shield-check" size={26} color={colors.success} />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            Tus datos viven en tu teléfono
          </AppText>
        </View>
        <AppText variant="caption" tone="muted">
          Careful no usa servidores. Además, Android incluye la base de datos en la copia de seguridad de tu cuenta de Google (Google One) y la restaura al reinstalar la app.
        </AppText>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Respaldo automático
        </AppText>
        <Card padded={false}>
          <ListRow
            icon="folder"
            title="Carpeta de respaldos"
            subtitle={backup.folderLabel ?? 'Elegí una carpeta (por ejemplo, Documentos/Careful)'}
            onPress={() => void chooseFolder()}
          />
          <SwitchRow
            icon="backup-restore"
            title="Respaldar automáticamente"
            subtitle={backup.lastBackupAt ? `Último: ${relativeDays(backup.lastBackupAt.slice(0, 10))}` : 'Todavía no se hizo ninguno'}
            value={backup.enabled && !!backup.folderUri}
            onChange={(v) => (v && !backup.folderUri ? void chooseFolder() : void patch({ enabled: v }))}
          />
          <SwitchRow
            icon="lightning-bolt"
            title="Además, tras cada registro"
            subtitle="Respalda unos segundos después de cada cambio"
            value={backup.onEveryChange}
            disabled={!backup.enabled}
            onChange={(v) => void patch({ onEveryChange: v })}
            last
          />
        </Card>
        <View style={{ gap: 6, opacity: backup.enabled ? 1 : 0.5 }}>
          <AppText variant="captionStrong">Frecuencia</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {BACKUP_INTERVALS_HOURS.map((h) => (
              <Pressable
                key={h}
                disabled={!backup.enabled}
                onPress={() => void patch({ intervalHours: h })}
                style={{
                  paddingHorizontal: 14,
                  height: 36,
                  borderRadius: radius.pill,
                  justifyContent: 'center',
                  backgroundColor: backup.intervalHours === h ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: backup.intervalHours === h ? colors.primary : colors.border,
                }}>
                <AppText variant="captionStrong" color={backup.intervalHours === h ? '#fff' : colors.text}>
                  {intervalLabel(h)}
                </AppText>
              </Pressable>
            ))}
          </View>
          <AppText variant="caption" tone="subtle">
            Entre 1 hora y 1 semana. Android puede demorar la ejecución para cuidar la batería. Se conservan los últimos {backup.keep} respaldos.
          </AppText>
        </View>
        {backup.lastError ? (
          <AppText variant="caption" tone="danger">
            Último error: {backup.lastError}
          </AppText>
        ) : null}
        <Button label="Respaldar ahora" icon="content-save" variant="secondary" loading={busy === 'now'} disabled={!backup.folderUri} onPress={() => void runNow()} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Google Drive y otros
        </AppText>
        <Card padded={false}>
          <ListRow icon="google-drive" iconColor="#1FA463" title="Enviar respaldo a Drive" subtitle="Abre el menú compartir: elegí Drive, Gmail, WhatsApp…" onPress={() => void share()} />
          <ListRow icon="database-import" title="Restaurar desde archivo" subtitle="Elegí un .zip de Careful" onPress={() => void restore()} last />
        </Card>
        {busy === 'share' || busy === 'restore' ? (
          <AppText variant="caption" tone="muted">
            Procesando…
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

