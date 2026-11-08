import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Header, Screen } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Card, Icon, ListRow, SwitchRow } from '@/components/ui/primitives';
import { backupDateFromName } from '@/domain/backup-policy';
import { formatDay, formatMoment } from '@/lib/dates';
import {
  backupToDriveNow,
  backupToFolder,
  hasLocalData,
  pickBackupFolder,
  readBackupFile,
  readDriveBackup,
  restoreBackup,
  shareBackup,
  type RestorePreview,
} from '@/services/backup';
import { configureBackgroundTask } from '@/services/background';
import { connectDrive, disconnectDrive, DRIVE_FOLDER_NAME, isDriveAvailable, listDriveBackups, type DriveFile } from '@/services/drive';
import { syncNotifications } from '@/services/notifications';
import { BACKUP_INTERVALS_HOURS, useSettings, type BackupPrefs, type DrivePrefs } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const DRIVE_GREEN = '#1FA463';

const intervalLabel = (h: number) => (h < 24 ? `${h} h` : h === 24 ? '1 día' : h === 168 ? '1 semana' : `${h / 24} días`);

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

type Busy = null | 'now' | 'share' | 'restore' | 'connect' | 'drive-now' | 'drive-list' | 'drive-restore';

function driveStatus(drive: DrivePrefs): string {
  if (!drive.enabled) return 'Desactivada: solo se sube cuando tocás «Subir ahora»';
  if (drive.pending) return drive.wifiOnly ? 'Hay cambios pendientes: se suben cuando haya Wi-Fi' : 'Hay cambios pendientes de subir';
  return drive.lastAt ? `Último: ${formatMoment(drive.lastAt)}` : 'Todavía no se subió ningún respaldo';
}

export default function BackupScreen() {
  const { colors } = useTheme();
  const backup = useSettings((s) => s.backup);
  const drive = useSettings((s) => s.drive);
  const [busy, setBusy] = useState<Busy>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const connected = !!drive.email;
  const autoActive = (backup.enabled && !!backup.folderUri) || (drive.enabled && connected);

  const patchBackup = async (p: Partial<BackupPrefs>) => {
    await useSettings.getState().patch('backup', p);
    void configureBackgroundTask().catch(() => undefined);
  };
  const patchDrive = async (p: Partial<DrivePrefs>) => {
    await useSettings.getState().patch('drive', p);
    void configureBackgroundTask().catch(() => undefined);
  };

  /* ------------------------------ Google Drive ----------------------------- */

  const connect = async () => {
    setBusy('connect');
    try {
      const { email } = await connectDrive();
      void configureBackgroundTask().catch(() => undefined);
      toast(email ? `Conectado como ${email}` : 'Google Drive conectado');
      if (await hasLocalData()) {
        // first upload right away, so the user sees it working
        setBusy('drive-now');
        await backupToDriveNow();
        toast(`Respaldo subido a «${DRIVE_FOLDER_NAME}»`);
      } else {
        // new phone / fresh install: offer the backups already in Drive
        setBusy(null);
        await openDriveBackups();
      }
    } catch (e) {
      const msg = errorText(e, 'No se pudo conectar con Google Drive');
      if ((e as { code?: string }).code === 'ERR_CANCELED') {
        toast(msg, 'info');
      } else {
        await useSettings.getState().patch('drive', { lastError: msg });
        toast(msg, 'error');
      }
    } finally {
      setBusy(null);
    }
  };

  const uploadNow = async () => {
    setBusy('drive-now');
    try {
      const r = await backupToDriveNow();
      toast(`Respaldo subido (${sizeLabel(r.size)})`);
    } catch (e) {
      const msg = errorText(e, 'No se pudo subir el respaldo');
      await useSettings.getState().patch('drive', { lastError: msg });
      toast(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  const openDriveBackups = async () => {
    setDriveFiles(null);
    setSheetOpen(true);
    setBusy('drive-list');
    try {
      setDriveFiles(await listDriveBackups());
    } catch (e) {
      setSheetOpen(false);
      toast(errorText(e, 'No se pudo leer Google Drive'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const restoreFromDrive = async (file: DriveFile) => {
    setBusy('drive-restore');
    let preview: RestorePreview | null = null;
    try {
      preview = await readDriveBackup(file.id);
    } catch (e) {
      toast(errorText(e, 'No se pudo descargar el respaldo'), 'error');
    } finally {
      setBusy(null);
    }
    if (!preview) return;
    setSheetOpen(false);
    confirmRestore(preview);
  };

  const disconnect = () => {
    Alert.alert(
      'Desconectar Google Drive',
      `Careful deja de subir respaldos y pierde el acceso a tu Drive. Los respaldos que ya están en «${DRIVE_FOLDER_NAME}» no se borran.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await disconnectDrive();
            void configureBackgroundTask().catch(() => undefined);
            toast('Google Drive desconectado');
          },
        },
      ],
    );
  };

  /* --------------------------------- Folder -------------------------------- */

  const chooseFolder = async () => {
    try {
      const folder = await pickBackupFolder();
      if (!folder) return;
      await patchBackup({ folderUri: folder.uri, folderLabel: folder.label, enabled: true, lastError: null });
      toast('Carpeta configurada');
    } catch (e) {
      toast(errorText(e, 'No se pudo elegir la carpeta'), 'error');
    }
  };

  const runNow = async () => {
    setBusy('now');
    try {
      const r = await backupToFolder();
      toast(`Respaldo guardado (${sizeLabel(r.size)})`);
    } catch (e) {
      const msg = errorText(e, 'No se pudo guardar el respaldo');
      await useSettings.getState().patch('backup', { lastError: msg });
      toast(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  /* --------------------------------- Others -------------------------------- */

  const share = async () => {
    setBusy('share');
    try {
      await shareBackup();
    } catch (e) {
      toast(errorText(e, 'No se pudo crear el respaldo'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const restoreFromFile = async () => {
    let preview: RestorePreview | null = null;
    try {
      setBusy('restore');
      preview = await readBackupFile();
    } catch (e) {
      toast(errorText(e, 'Archivo inválido'), 'error');
    } finally {
      setBusy(null);
    }
    if (preview) confirmRestore(preview);
  };

  const confirmRestore = (p: RestorePreview) => {
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
              toast(errorText(e, 'No se pudo restaurar'), 'error');
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
          Careful no usa servidores propios. Los respaldos van a tu Google Drive o a una carpeta que elijas, y Android además incluye la base de datos en la copia de seguridad de tu cuenta de Google.
        </AppText>
      </Card>

      {isDriveAvailable() ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="overline" tone="muted">
            Google Drive
          </AppText>
          {connected ? (
            <Card padded={false}>
              <ListRow icon="google-drive" iconColor={DRIVE_GREEN} title={drive.name ?? 'Cuenta de Google'} subtitle={`${drive.email} · carpeta «${DRIVE_FOLDER_NAME}»`} />
              <SwitchRow icon="cloud-sync" title="Sincronizar automáticamente" subtitle={driveStatus(drive)} value={drive.enabled} onChange={(v) => void patchDrive({ enabled: v })} />
              <SwitchRow
                icon="wifi"
                title="Solo con Wi-Fi"
                subtitle={drive.wifiOnly ? 'No usa datos móviles' : 'Usa Wi-Fi o datos móviles'}
                value={drive.wifiOnly}
                onChange={(v) => void patchDrive({ wifiOnly: v })}
              />
              <ListRow
                icon="cloud-upload"
                title="Subir ahora"
                subtitle="Crea un respaldo y lo sube a tu Drive"
                onPress={busy ? undefined : () => void uploadNow()}
                right={busy === 'drive-now' ? <ActivityIndicator color={colors.primary} /> : undefined}
              />
              <ListRow icon="cloud-download" title="Restaurar desde Drive" subtitle="Elegí uno de tus respaldos" onPress={busy ? undefined : () => void openDriveBackups()} />
              <ListRow icon="logout" title="Desconectar" danger onPress={disconnect} last />
            </Card>
          ) : (
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: DRIVE_GREEN + '1F', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="google-drive" size={26} color={DRIVE_GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">Sincronizar con Google Drive</AppText>
                  <AppText variant="caption" tone="muted">
                    Respaldos automáticos en la carpeta «{DRIVE_FOLDER_NAME}» de tu Drive.
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" tone="subtle">
                Careful solo puede ver los archivos que crea; el resto de tu Drive sigue siendo privado.
              </AppText>
              <Button label="Conectar Google Drive" icon="google-drive" loading={busy === 'connect' || busy === 'drive-now'} onPress={() => void connect()} />
            </Card>
          )}
          {drive.lastError ? (
            <AppText variant="caption" tone="danger">
              Último error: {drive.lastError}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Carpeta del teléfono
        </AppText>
        <Card padded={false}>
          <ListRow
            icon="folder"
            title="Carpeta de respaldos"
            subtitle={backup.folderLabel?.replace(/\/+$/, '') ?? 'Elegí una carpeta (por ejemplo, Documentos/Careful)'}
            onPress={() => void chooseFolder()}
          />
          <SwitchRow
            icon="backup-restore"
            title="Respaldar automáticamente"
            subtitle={backup.lastBackupAt ? `Último: ${formatMoment(backup.lastBackupAt)}` : 'Todavía no se hizo ninguno'}
            value={backup.enabled && !!backup.folderUri}
            onChange={(v) => (v && !backup.folderUri ? void chooseFolder() : void patchBackup({ enabled: v }))}
          />
          <ListRow
            icon="content-save"
            title="Respaldar ahora"
            onPress={backup.folderUri && !busy ? () => void runNow() : undefined}
            right={busy === 'now' ? <ActivityIndicator color={colors.primary} /> : undefined}
            last
          />
        </Card>
        {backup.lastError ? (
          <AppText variant="caption" tone="danger">
            Último error: {backup.lastError}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm, opacity: autoActive ? 1 : 0.5 }}>
        <AppText variant="overline" tone="muted">
          Frecuencia automática
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {BACKUP_INTERVALS_HOURS.map((h) => (
            <Pressable
              key={h}
              disabled={!autoActive}
              onPress={() => void patchBackup({ intervalHours: h })}
              accessibilityRole="button"
              accessibilityState={{ selected: backup.intervalHours === h }}
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
        <Card padded={false}>
          <SwitchRow
            icon="lightning-bolt"
            title="Además, tras cada registro"
            subtitle="Respalda unos segundos después de cada cambio"
            value={backup.onEveryChange}
            disabled={!autoActive}
            onChange={(v) => void patchBackup({ onEveryChange: v })}
            last
          />
        </Card>
        <AppText variant="caption" tone="subtle">
          Vale para Google Drive y para la carpeta. Android puede demorar la ejecución para cuidar la batería. Se conservan los últimos {backup.keep} respaldos en cada destino.
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Otros
        </AppText>
        <Card padded={false}>
          <ListRow icon="share-variant" title="Compartir respaldo" subtitle="Enviá un .zip por Gmail, WhatsApp u otra app" onPress={busy ? undefined : () => void share()} />
          <ListRow icon="database-import" title="Restaurar desde archivo" subtitle="Elegí un .zip de Careful" onPress={busy ? undefined : () => void restoreFromFile()} last />
        </Card>
        {busy === 'share' || busy === 'restore' ? (
          <AppText variant="caption" tone="muted">
            Procesando…
          </AppText>
        ) : null}
      </View>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Respaldos en Google Drive">
        {driveFiles === null ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="caption" tone="muted">
              Buscando respaldos…
            </AppText>
          </View>
        ) : driveFiles.length === 0 ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
            <Icon name="cloud-alert" size={32} color={colors.textSubtle} />
            <AppText variant="body" tone="muted" align="center">
              Todavía no hay respaldos en «{DRIVE_FOLDER_NAME}».
            </AppText>
          </View>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {busy === 'drive-restore' ? (
              <AppText variant="caption" tone="muted">
                Descargando…
              </AppText>
            ) : null}
            <Card padded={false}>
              {driveFiles.map((f, i) => {
                const when = backupDateFromName(f.name)?.toISOString() ?? f.createdTime;
                return (
                  <ListRow
                    key={f.id}
                    icon="zip-box"
                    title={when ? capitalize(formatMoment(when)) : f.name}
                    subtitle={`${sizeLabel(f.size)}${i === 0 ? ' · el más reciente' : ''}`}
                    onPress={busy ? undefined : () => void restoreFromDrive(f)}
                    last={i === driveFiles.length - 1}
                  />
                );
              })}
            </Card>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
