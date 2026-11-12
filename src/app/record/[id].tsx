import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { openDocument, PhotoViewer } from '@/components/pickers';
import { recordTitle, recordVisual } from '@/components/rows';
import { Header, Screen } from '@/components/ui/layout';
import { confirmIdentity } from '@/components/AuthPrompt';
import { openQuickRecord } from '@/components/QuickRecord';
import { AppText, Button, Card, Chip, Grid, Icon, IconButton, ListRow } from '@/components/ui/primitives';
import { deleteRecord, getRecord } from '@/db/records';
import { getVehicle } from '@/db/vehicles';
import { accessoryTag, findItem, itemName } from '@/domain/maintenance';
import { useQuery } from '@/hooks/useQuery';
import { formatDayLong } from '@/lib/dates';
import { formatAmount, formatKm } from '@/lib/format';
import { attachmentName, documentVisual, isImagePath } from '@/lib/attachments';
import { deletePhotoFiles, photoUri } from '@/services/photos';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [viewer, setViewer] = useState<number | null>(null);
  const { data } = useQuery(async () => {
    const record = await getRecord(id);
    const vehicle = record ? await getVehicle(record.vehicleId) : null;
    return { record, vehicle };
  }, [id]);

  const r = data?.record;
  if (!data) return null;
  if (!r) {
    return (
      <Screen header={<Header back />}>
        <AppText tone="muted">El registro ya no existe.</AppText>
      </Screen>
    );
  }
  const visual = recordVisual(r, colors.primary);
  const tag = r.kind === 'accessory' && r.items[0] ? accessoryTag(r.items[0].item) : undefined;
  const images = r.photos.map((p) => p.path).filter(isImagePath);
  const documents = r.photos.map((p) => p.path).filter((p) => !isImagePath(p));

  const edit = async () => {
    if (!(await confirmIdentity('Confirmá que sos vos para editar este registro.'))) return;
    if (r.kind === 'maintenance') router.push({ pathname: '/record/form', params: { id: r.id } });
    else openQuickRecord({ kind: r.kind, recordId: r.id });
  };

  const remove = async () => {
    if (!(await confirmIdentity('Confirmá que sos vos para eliminar este registro.'))) return;
    Alert.alert('Eliminar registro', 'Se borrará este registro y sus fotos. Los próximos services se recalculan automáticamente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          deletePhotoFiles(await deleteRecord(r.id));
          toast('Registro eliminado');
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen
      header={
        <Header
          back
          title="Detalle"
          right={
            <>
              <IconButton icon="pencil" accessibilityLabel="Editar" onPress={() => void edit()} />
              <IconButton icon="delete-outline" accessibilityLabel="Eliminar" color={colors.danger} onPress={() => void remove()} />
            </>
          }
        />
      }>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: visual.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={visual.icon} size={30} color={visual.color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="overline" tone="primary">
            {r.kind === 'maintenance' ? 'Mantenimiento' : r.kind === 'accessory' ? 'Accesorio' : 'Kilometraje'}
          </AppText>
          <AppText variant="title">{recordTitle({ kind: r.kind, items: r.items.slice(0, 2) })}</AppText>
        </View>
      </View>

      {r.amountCents !== null ? (
        <Card style={{ alignItems: 'center', gap: 2 }}>
          <AppText variant="caption" tone="muted">
            Monto
          </AppText>
          <AppText variant="display">{formatAmount(r.amountCents)}</AppText>
        </Card>
      ) : null}

      <Card padded={false}>
        {data.vehicle ? (
          <ListRow icon="car" title={`${data.vehicle.brand} ${data.vehicle.model}`} subtitle={data.vehicle.plate ?? undefined} onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: data.vehicle!.id } })} />
        ) : null}
        <ListRow icon="calendar-month" title="Fecha" subtitle={formatDayLong(r.date)} />
        <ListRow icon="speedometer" title="Kilometraje" subtitle={r.odometer !== null ? formatKm(r.odometer) : 'No registrado'} last={!r.workshop} />
        {r.workshop ? <ListRow icon="store-outline" title={r.kind === 'accessory' ? 'Comercio' : 'Taller'} subtitle={r.workshop} last /> : null}
      </Card>

      {r.kind === 'maintenance' && r.items.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subheading">Trabajos</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {r.items.map((i) => (
              <Chip key={i.id} size="sm" selected color={findItem(i.item)?.category.color ?? colors.primary} label={itemName(i)} />
            ))}
          </View>
        </View>
      ) : null}

      {tag ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subheading">Etiqueta</AppText>
          <View style={{ flexDirection: 'row' }}>
            <Chip size="sm" selected icon="tag" color={visual.color} label={tag.label} />
          </View>
        </View>
      ) : null}

      {r.description ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subheading">Descripción</AppText>
          <Card>
            <AppText>{r.description}</AppText>
          </Card>
        </View>
      ) : null}

      {images.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subheading">Fotos</AppText>
          <Grid columns={3} gap={spacing.xs}>
            {images.map((p, i) => (
              <Pressable key={p} onPress={() => setViewer(i)} style={{ aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' }}>
                <Image source={{ uri: photoUri(p) ?? undefined }} style={{ flex: 1 }} contentFit="cover" />
              </Pressable>
            ))}
          </Grid>
        </View>
      ) : null}

      {documents.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subheading">Archivos</AppText>
          <Card padded={false}>
            {documents.map((p, i) => {
              const visual = documentVisual(p);
              return (
                <ListRow
                  key={p}
                  icon={visual.icon}
                  iconColor={visual.color}
                  title={attachmentName(p)}
                  subtitle={`${visual.label} · tocá para abrirlo`}
                  last={i === documents.length - 1}
                  right={<Icon name="open-in-new" size={20} color={colors.textSubtle} />}
                  onPress={() => void openDocument(p)}
                />
              );
            })}
          </Card>
        </View>
      ) : null}

      <Button label="Editar registro" icon="pencil" variant="secondary" onPress={() => void edit()} />
      <PhotoViewer photos={images} index={viewer} onClose={() => setViewer(null)} />
    </Screen>
  );
}
