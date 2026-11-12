import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { RecordRow } from '@/components/rows';
import { FilterButton, FilterSheet, type FilterOption } from '@/components/ui/filters';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Chip, EmptyState } from '@/components/ui/primitives';
import { getAccessoryTagCounts, listRecords } from '@/db/records';
import type { RecordKind } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { ACCESSORY_ICONS, accessoryTag } from '@/domain/maintenance';
import { formatPlate } from '@/domain/plate';
import { useQuery } from '@/hooks/useQuery';
import { formatMonth } from '@/lib/dates';
import { formatAmount, pluralize } from '@/lib/format';
import { vehicleLabel } from '@/services/upcoming';
import { spacing } from '@/theme/tokens';

const KINDS: { key: RecordKind; label: string; icon: string }[] = [
  { key: 'maintenance', label: 'Servicio / Mantenimiento', icon: 'wrench' },
  { key: 'accessory', label: 'Accesorios', icon: 'star-four-points' },
  { key: 'odometer', label: 'Kilometraje', icon: 'speedometer' },
];

/** The full log of every car, newest first, grouped by month; filterable by car, type and accessory tag. */
export default function HistoryScreen() {
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [kind, setKind] = useState<RecordKind | null>(null);
  /** Accessory tag (item key); only applies while filtering accessories. */
  const [tag, setTag] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | 'vehicle' | 'kind'>(null);
  const [limit, setLimit] = useState(60);

  const activeTag = kind === 'accessory' ? tag : null;
  const { data } = useQuery(async () => {
    const [vehicles, records, tags] = await Promise.all([
      listVehicles({ includeArchived: true }),
      listRecords({ vehicleId, kinds: kind ? [kind] : undefined, items: activeTag ? [activeTag] : undefined, limit }),
      kind === 'accessory' ? getAccessoryTagCounts(vehicleId) : Promise.resolve([]),
    ]);
    return { vehicles, records, tags };
  }, [vehicleId, kind, activeTag, limit]);

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['records']>();
    for (const r of data?.records ?? []) {
      const m = r.date.slice(0, 7);
      map.set(m, [...(map.get(m) ?? []), r]);
    }
    return [...map.entries()];
  }, [data]);

  const vehicles = data?.vehicles ?? [];
  const activeVehicle = vehicles.find((v) => v.id === vehicleId);
  const filtered = !!activeVehicle || kind !== null;
  const tagLabel = (item: string) => accessoryTag(item)?.label ?? 'Sin etiqueta';

  const options: FilterOption[] =
    picker === 'vehicle'
      ? [
          { key: null, label: 'Todos los autos', icon: 'car-multiple' },
          ...vehicles.map((v) => ({
            key: v.id,
            label: vehicleLabel(v),
            subtitle: [v.plate ? formatPlate(v.plate, v.country) : null, v.archivedAt ? 'Archivado' : null].filter(Boolean).join(' · ') || undefined,
            icon: v.archivedAt ? 'archive-outline' : 'car',
          })),
        ]
      : [{ key: null, label: 'Todos los tipos', icon: 'format-list-bulleted' }, ...KINDS];

  return (
    <Screen tabBar header={<Header large title="Historial" subtitle="Todo lo que le hiciste a tus autos" />}>
      {vehicles.length ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <FilterButton icon="car" label={activeVehicle ? vehicleLabel(activeVehicle) : 'Todos los autos'} active={!!activeVehicle} onPress={() => setPicker('vehicle')} />
          <FilterButton icon="filter-variant" label={KINDS.find((k) => k.key === kind)?.label ?? 'Todos los tipos'} active={kind !== null} onPress={() => setPicker('kind')} />
        </View>
      ) : null}

      {kind === 'accessory' && data?.tags.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -spacing.lg }}>
          <View style={{ width: spacing.lg - 6 }} />
          <Chip size="sm" icon="tag-multiple" label="Todas" selected={!activeTag} onPress={() => setTag(null)} />
          {data.tags.map((t) => (
            <Chip
              key={t.item}
              size="sm"
              icon={ACCESSORY_ICONS[t.item] ?? 'tag'}
              label={`${tagLabel(t.item)} · ${t.count}`}
              selected={activeTag === t.item}
              onPress={() => setTag(activeTag === t.item ? null : t.item)}
            />
          ))}
          <View style={{ width: spacing.lg - 6 }} />
        </ScrollView>
      ) : null}

      {data && !data.records.length ? (
        filtered ? (
          <Card style={{ gap: spacing.sm }}>
            <AppText tone="muted">No hay registros con estos filtros.</AppText>
            <Button
              label="Quitar filtros"
              variant="secondary"
              icon="filter-remove-outline"
              onPress={() => {
                setVehicleId(null);
                setKind(null);
                setTag(null);
              }}
            />
          </Card>
        ) : (
          <EmptyState
            icon="history"
            title="Sin movimientos"
            message={vehicles.length ? 'Tocá el botón + para registrar un service, accesorio o kilometraje.' : 'Agregá tu primer auto para empezar su historial.'}
            action={!vehicles.length ? <Button label="Agregar auto" icon="car-2-plus" onPress={() => router.push('/vehicle/form')} /> : undefined}
          />
        )
      ) : null}

      {groups.map(([month, records]) => {
        const total = records.reduce((s, r) => s + (r.amountCents ?? 0), 0);
        return (
          <View key={month} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 }}>
              <AppText variant="subheading" style={{ textTransform: 'capitalize' }}>
                {formatMonth(month)}
              </AppText>
              <AppText variant="caption" tone="muted">
                {pluralize(records.length, 'registro', 'registros')}
                {total ? ` · ${formatAmount(total)}` : ''}
              </AppText>
            </View>
            <View style={{ gap: 6 }}>
              {records.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  vehicle={vehicles.find((v) => v.id === r.vehicleId)}
                  showVehicle={vehicles.length > 1 && !activeVehicle}
                  onPress={() => router.push({ pathname: '/record/[id]', params: { id: r.id } })}
                />
              ))}
            </View>
          </View>
        );
      })}

      {data && data.records.length >= limit ? <Button label="Ver más" variant="ghost" onPress={() => setLimit((l) => l + 60)} /> : null}

      <FilterSheet
        visible={!!picker}
        title={picker === 'vehicle' ? 'Filtrar por auto' : 'Filtrar por tipo'}
        options={options}
        selected={picker === 'vehicle' ? (activeVehicle?.id ?? null) : kind}
        onSelect={(key) => {
          if (picker === 'vehicle') setVehicleId(key);
          else setKind(key as RecordKind | null);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}
