import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

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
import { useSettings, type BackupPrefs, type DrivePrefs } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const DRIVE_GREEN = '#1FA463';

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

type Busy = null | 'now' | 'share' | 'restore' | 'connect' | 'drive-now' | 'drive-list' | 'drive-restore';

function driveStatus(drive: DrivePrefs): string {
  if (drive.pending) return drive.wifiOnly ? 'Cambios pendientes: se suben cuando haya Wi-Fi' : 'Cambios pendientes de subir';
  return drive.lastAt ? `Última copia: ${formatMoment(drive.lastAt)}` : 'Todavía no se subió ninguna copia';
}

export default function BackupScreen() {
  const { colors } = useTheme();
  const backup = useSettings((s) => s.backup);
  const drive = useSettings((s) => s.drive);
  const [busy, setBusy] = useState<Busy>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const connected = !!drive.email;
  const folderLabel = backup.folderLabel?.replace(/\/+$/, '') ?? null;

  const patchBackup = async (p: Partial<BackupPrefs>) => {
    await useSettings.getState().patch('backup', p);
    void configureBackgroundTask().catch(() => undefined);
  };

  /* ---------------------------------- Nube --------------------------------- */

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
        toast(`Copia subida a «${DRIVE_FOLDER_NAME}»`);
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
      toast(`Copia subida (${sizeLabel(r.size)})`);
    } catch (e) {
      const msg = errorText(e, 'No se pudo subir la copia');
      await useSettings.getState().patch('drive', { lastError: msg });
      toast(msg, 'error');
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
      toast(errorText(e, 'No se pudo descargar la copia'), 'error');
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
      `Careful deja de subir copias y pierde el acceso a tu Drive. Las copias que ya están en «${DRIVE_FOLDER_NAME}» no se borran.`,
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

  /* --------------------------------- Local --------------------------------- */

  const chooseFolder = async () => {
    try {
      const folder = await pickBackupFolder();
      if (!folder) return;
      await patchBackup({ folderUri: folder.uri, folderLabel: folder.label, lastError: null });
      toast('Carpeta configurada');
      void runFolderNow(true);
    } catch (e) {
      toast(errorText(e, 'No se pudo elegir la carpeta'), 'error');
    }
  };

  const removeFolder = () => {
    Alert.alert('Dejar de usar la carpeta', 'Careful deja de guardar copias en esta carpeta. Las copias que ya están ahí no se borran.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => void patchBackup({ folderUri: null, folderLabel: null, lastBackupAt: null, lastError: null }) },
    ]);
  };

  const runFolderNow = async (quiet = false) => {
    setBusy('now');
    try {
      if (quiet && !(await hasLocalData())) return;
      const r = await backupToFolder();
      toast(`Copia guardada (${sizeLabel(r.size)})`);
    } catch (e) {
      const msg = errorText(e, 'No se pudo guardar la copia');
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
      toast(errorText(e, 'No se pudo crear la copia'), 'error');
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
      'Restaurar copia',
      `Copia del ${formatDay(p.exportedAt.slice(0, 10))}: ${p.vehicles} vehículos y ${p.records} registros.\n\nReemplaza TODOS los datos actuales de este teléfono.`,
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

  const spinner = (on: boolean) => (on ? <ActivityIndicator color={colors.primary} /> : undefined);

  return (
    <Screen header={<Header back title="Respaldo y sincronización" />}>
      {/* What it does and how, in one quick read */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <Icon name="shield-sync" size={24} color={colors.success} />
        <AppText variant="body" tone="muted" style={{ flex: 1 }}>
          Careful guarda una copia de tus autos, registros y fotos <AppText variant="bodyStrong">cada vez que hacés un cambio</AppText> y{' '}
          <AppText variant="bodyStrong">todas las noches</AppText>, sin que tengas que hacer nada. Elegí dónde: en la nube, en tu Google Drive, o en el teléfono. Si cambiás de
          celular, recuperás todo con «Restaurar».
        </AppText>
      </View>

      {isDriveAvailable() ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="overline" tone="muted">
            Nube
          </AppText>
          {connected ? (
            <Card padded={false}>
              <ListRow icon="google-drive" iconColor={DRIVE_GREEN} title={drive.name ?? drive.email ?? 'Google Drive'} subtitle={`${drive.email} · ${driveStatus(drive)}`} />
              <SwitchRow
                icon="wifi"
                title="Solo con Wi-Fi"
                subtitle={drive.wifiOnly ? 'No usa datos móviles' : 'Usa Wi-Fi o datos móviles'}
                value={drive.wifiOnly}
                onChange={(v) => void useSettings.getState().patch('drive', { wifiOnly: v })}
              />
              <ListRow icon="cloud-upload" title="Subir ahora" onPress={busy ? undefined : () => void uploadNow()} right={spinner(busy === 'drive-now')} />
              <ListRow icon="cloud-download" title="Restaurar desde Drive" onPress={busy ? undefined : () => void openDriveBackups()} />
              <ListRow icon="logout" title="Desconectar" danger onPress={disconnect} last />
            </Card>
          ) : (
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: DRIVE_GREEN + '1F', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="google-drive" size={26} color={DRIVE_GREEN} />
                </View>
                <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                  Las copias se guardan en la carpeta «{DRIVE_FOLDER_NAME}» de tu Drive. Careful solo ve los archivos que crea.
                </AppText>
              </View>
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
          Local
        </AppText>
        <Card padded={false}>
          <ListRow
            icon="folder"
            title={folderLabel ?? 'Elegir carpeta del teléfono'}
            subtitle={
              backup.folderUri
                ? backup.lastBackupAt
                  ? `Última copia: ${formatMoment(backup.lastBackupAt)}`
                  : 'Todavía no se guardó ninguna copia'
                : 'Por ejemplo, Documentos/Careful'
            }
            onPress={() => void chooseFolder()}
          />
          {backup.folderUri ? (
            <ListRow icon="content-save" title="Guardar copia ahora" onPress={busy ? undefined : () => void runFolderNow()} right={spinner(busy === 'now')} />
          ) : null}
          <ListRow icon="share-variant" title="Compartir copia" subtitle="Enviala por Gmail, WhatsApp u otra app" onPress={busy ? undefined : () => void share()} right={spinner(busy === 'share')} />
          <ListRow
            icon="database-import"
            title="Restaurar desde archivo"
            subtitle="Elegí un .zip de Careful"
            onPress={busy ? undefined : () => void restoreFromFile()}
            right={spinner(busy === 'restore')}
            last={!backup.folderUri}
          />
          {backup.folderUri ? <ListRow icon="folder-remove" title="Dejar de usar la carpeta" danger onPress={removeFolder} last /> : null}
        </Card>
        {backup.lastError ? (
          <AppText variant="caption" tone="danger">
            Último error: {backup.lastError}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="subtle">
          Se conservan las 5 copias más recientes y una por día de las últimas 2 semanas.
        </AppText>
      </View>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Copias en Google Drive">
        {driveFiles === null ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="caption" tone="muted">
              Buscando copias…
            </AppText>
          </View>
        ) : driveFiles.length === 0 ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
            <Icon name="cloud-alert" size={32} color={colors.textSubtle} />
            <AppText variant="body" tone="muted" align="center">
              Todavía no hay copias en «{DRIVE_FOLDER_NAME}».
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
                    subtitle={`${sizeLabel(f.size)}${i === 0 ? ' · la más reciente' : ''}`}
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
