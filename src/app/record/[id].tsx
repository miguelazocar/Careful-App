import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { PhotoViewer } from '@/components/pickers';
import { recordTitle, recordVisual } from '@/components/rows';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Chip, Grid, Icon, IconButton, ListRow } from '@/components/ui/primitives';
import { deleteRecord, getRecord } from '@/db/records';
import { getVehicle } from '@/db/vehicles';
import { findItem, isOtherItem } from '@/domain/maintenance';
import { useQuery } from '@/hooks/useQuery';
import { formatDayLong } from '@/lib/dates';
import { formatAmount, formatKm } from '@/lib/format';
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

  const remove = () =>
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

  return (
    <Screen
      header={
        <Header
          back
          title="Detalle"
          right={
            <>
              <IconButton icon="pencil" accessibilityLabel="Editar" onPress={() => router.push({ pathname: '/record/form', params: { id: r.id } })} />
              <IconButton icon="delete-outline" accessibilityLabel="Eliminar" color={colors.danger} onPress={remove} />
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

      {r.items.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subheading">Trabajos</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {r.items.map((i) => {
              const meta = findItem(i.item);
              return <Chip key={i.id} size="sm" selected color={meta?.category.color ?? colors.primary} label={isOtherItem(i.item) ? i.label : (meta?.item.label ?? i.label)} />;
            })}
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

      {r.photos.length ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="subheading">Fotos</AppText>
          <Grid columns={3} gap={spacing.xs}>
            {r.photos.map((p, i) => (
              <Pressable key={p.id} onPress={() => setViewer(i)} style={{ aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' }}>
                <Image source={{ uri: photoUri(p.path) ?? undefined }} style={{ flex: 1 }} contentFit="cover" />
              </Pressable>
            ))}
          </Grid>
        </View>
      ) : null}

      <Button label="Editar registro" icon="pencil" variant="secondary" onPress={() => router.push({ pathname: '/record/form', params: { id: r.id } })} />
      <PhotoViewer photos={r.photos.map((p) => p.path)} index={viewer} onClose={() => setViewer(null)} />
    </Screen>
  );
}
