import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { MonthlyChart, type MonthValue } from '@/components/MonthlyChart';
import { RecordRow } from '@/components/rows';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Chip, EmptyState } from '@/components/ui/primitives';
import { getMonthlySpend, listRecords } from '@/db/records';
import type { RecordKind } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { useQuery } from '@/hooks/useQuery';
import { addMonthsTo, formatMonth, today } from '@/lib/dates';
import { formatAmount, pluralize } from '@/lib/format';
import { spacing } from '@/theme/tokens';

type KindFilter = 'all' | RecordKind;
const KIND_FILTERS: { value: KindFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'Todo', icon: 'format-list-checks' },
  { value: 'maintenance', label: 'Mantenimiento', icon: 'wrench' },
  { value: 'accessory', label: 'Accesorios', icon: 'star-four-points' },
  { value: 'odometer', label: 'Kilometraje', icon: 'speedometer' },
];

function lastMonths(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonthsTo(`${today().slice(0, 7)}-01`, -i).slice(0, 7));
  return out;
}

export default function HistoryScreen() {
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [limit, setLimit] = useState(60);

  const { data } = useQuery(async () => {
    const months = lastMonths(6);
    const [vehicles, records, spend] = await Promise.all([
      listVehicles({ includeArchived: true }),
      listRecords({ vehicleId, kinds: kind === 'all' ? undefined : [kind], limit }),
      getMonthlySpend(`${months[0]}-01`, vehicleId),
    ]);
    const chart: MonthValue[] = months.map((m) => spend.find((s) => s.month === m) ?? { month: m, cents: 0, count: 0 });
    return { vehicles, records, chart };
  }, [vehicleId, kind, limit]);

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['records']>();
    for (const r of data?.records ?? []) {
      const m = r.date.slice(0, 7);
      map.set(m, [...(map.get(m) ?? []), r]);
    }
    return [...map.entries()];
  }, [data]);

  const vehicles = data?.vehicles ?? [];
  const sixMonthTotal = data?.chart.reduce((s, m) => s + m.cents, 0) ?? 0;

  return (
    <Screen tabBar header={<Header large title="Historial" subtitle="Todo lo que le hiciste a tus autos" />}>
      {vehicles.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -spacing.lg }} contentInset={{ left: spacing.lg }}>
          <View style={{ width: spacing.lg - 6 }} />
          <Chip label="Todos" selected={!vehicleId} onPress={() => setVehicleId(null)} />
          {vehicles.map((v) => (
            <Chip key={v.id} label={v.model} selected={vehicleId === v.id} onPress={() => setVehicleId(v.id)} />
          ))}
          <View style={{ width: spacing.lg - 6 }} />
        </ScrollView>
      ) : null}

      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <AppText variant="caption" tone="muted">
              Gastos de los últimos 6 meses
            </AppText>
            <AppText variant="title">{formatAmount(sixMonthTotal)}</AppText>
          </View>
        </View>
        {data ? <MonthlyChart data={data.chart} /> : <View style={{ height: 170 }} />}
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -spacing.lg }}>
        <View style={{ width: spacing.lg - 6 }} />
        {KIND_FILTERS.map((k) => (
          <Chip key={k.value} size="sm" icon={k.icon} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />
        ))}
        <View style={{ width: spacing.lg - 6 }} />
      </ScrollView>

      {data && !data.records.length ? (
        <EmptyState
          icon="history"
          title="Sin movimientos"
          message={vehicles.length ? 'Tocá el botón + para registrar un service, accesorio o kilometraje.' : 'Agregá tu primer auto para empezar su historial.'}
          action={!vehicles.length ? <Button label="Agregar auto" icon="car-2-plus" onPress={() => router.push('/vehicle/form')} /> : undefined}
        />
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
                  showVehicle={vehicles.length > 1 && !vehicleId}
                  onPress={() => router.push({ pathname: '/record/[id]', params: { id: r.id } })}
                />
              ))}
            </View>
          </View>
        );
      })}

      {data && data.records.length >= limit ? <Button label="Ver más" variant="ghost" onPress={() => setLimit((l) => l + 60)} /> : null}
    </Screen>
  );
}
