import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { dueLabel, upcomingVisual } from '@/components/rows';
import { FilterButton, FilterSheet, type FilterOption } from '@/components/ui/filters';
import { Sheet } from '@/components/ui/overlays';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, EmptyState, Icon, IconButton, ListRow } from '@/components/ui/primitives';
import { setManualReminderDone } from '@/db/reminders';
import type { Vehicle } from '@/db/types';
import { agendaSections, MANUAL_TYPE, matchesAgendaFilter, type AgendaFilter } from '@/domain/agenda';
import { findItem, PLAN_ITEMS } from '@/domain/maintenance';
import { formatPlate } from '@/domain/plate';
import type { UpcomingItem } from '@/domain/schedule';
import { useQuery } from '@/hooks/useQuery';
import { formatDay, relativeDays, today } from '@/lib/dates';
import { formatInt } from '@/lib/format';
import { loadUpcoming, vehicleLabel } from '@/services/upcoming';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Agenda: every scheduled service and reminder, in chronological order, filterable by car and type. */
export default function CalendarScreen() {
  const { colors } = useTheme();
  const warnKm = useSettings((s) => s.notifications.warnKm);
  const [filter, setFilter] = useState<AgendaFilter>({ vehicleId: null, type: null });
  const [picker, setPicker] = useState<null | 'vehicle' | 'type'>(null);
  const [action, setAction] = useState<UpcomingItem | null>(null);
  const { data } = useQuery(() => loadUpcoming({ warnKm }), [warnKm]);

  const vehicles = useMemo(() => [...(data?.snapshots.values() ?? [])].map((s) => s.vehicle), [data]);
  const items = useMemo(() => data?.items ?? [], [data]);
  // a filter pointing at a vehicle that no longer exists falls back to "all"
  const active: AgendaFilter = { ...filter, vehicleId: vehicles.some((v) => v.id === filter.vehicleId) ? filter.vehicleId : null };
  const sections = agendaSections(items.filter((i) => matchesAgendaFilter(i, active)));

  const vehicleOf = (id: string) => data?.snapshots.get(id)?.vehicle;
  const noVehicles = data && data.snapshots.size === 0;
  const filtered = active.vehicleId !== null || active.type !== null;
  const typeLabel = active.type === null ? 'Todos los tipos' : active.type === MANUAL_TYPE ? 'Recordatorios' : (findItem(active.type)?.item.label ?? 'Tipo');
  const activeVehicle = active.vehicleId ? vehicleOf(active.vehicleId) : undefined;

  return (
    <Screen
      tabBar
      header={
        <Header
          large
          title="Agenda"
          subtitle="Lo que toca hacer, en orden"
          right={!noVehicles ? <IconButton icon="bell-plus" tone="primary" accessibilityLabel="Nuevo recordatorio" onPress={() => router.push('/reminder/form')} /> : undefined}
        />
      }>
      {noVehicles ? (
        <EmptyState icon="calendar-month" title="Nada agendado todavía" message="Agregá un auto y Careful agenda su plan de mantenimiento por fecha o kilometraje." action={<Button label="Agregar auto" icon="car-2-plus" onPress={() => router.push('/vehicle/form')} />} />
      ) : data ? (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <FilterButton icon="car" label={activeVehicle ? vehicleLabel(activeVehicle) : 'Todos los autos'} active={!!activeVehicle} onPress={() => setPicker('vehicle')} />
            <FilterButton icon="filter-variant" label={typeLabel} active={active.type !== null} onPress={() => setPicker('type')} />
          </View>

          {sections.length ? (
            sections.map((s) => (
              <View key={s.key} style={{ gap: spacing.xs }}>
                <AppText variant="subheading" tone={s.kind === 'overdue' ? 'danger' : 'default'}>
                  {s.title}
                </AppText>
                {s.items.map((it) => (
                  <AgendaRow key={it.key} item={it} vehicle={vehicleOf(it.vehicleId)} onPress={() => setAction(it)} />
                ))}
              </View>
            ))
          ) : (
            <Card style={{ gap: spacing.sm }}>
              <AppText tone="muted">{filtered ? 'No hay nada programado con estos filtros.' : 'No hay services programados. Revisá el plan de mantenimiento de tus autos.'}</AppText>
              {filtered ? <Button label="Quitar filtros" variant="secondary" icon="filter-remove-outline" onPress={() => setFilter({ vehicleId: null, type: null })} /> : null}
            </Card>
          )}
        </>
      ) : null}

      <FilterSheet
        visible={!!picker}
        title={picker === 'vehicle' ? 'Filtrar por auto' : 'Filtrar por tipo'}
        options={picker ? filterOptions(picker, items, vehicles, active) : []}
        selected={picker === 'vehicle' ? active.vehicleId : active.type}
        onSelect={(key) => {
          setFilter(picker === 'vehicle' ? { ...active, vehicleId: key } : { ...active, type: key });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      <Sheet visible={!!action} onClose={() => setAction(null)} title={action?.title}>
        {action ? (
          <View style={{ gap: spacing.md }}>
            <AppText tone="muted">
              {vehicleOf(action.vehicleId) ? vehicleLabel(vehicleOf(action.vehicleId)!) : ''}
              {action.due.effectiveDate ? ` · ${formatDay(action.due.effectiveDate)}` : ''}
            </AppText>
            <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
              {action.source === 'service' ? (
                <ListRow
                  icon="check-circle"
                  iconColor={colors.success}
                  title="Registrar como hecho"
                  subtitle="Carga el service y reprograma el próximo"
                  onPress={() => {
                    setAction(null);
                    router.push({ pathname: '/record/form', params: { kind: 'maintenance', vehicleId: action.vehicleId, item: action.item } });
                  }}
                />
              ) : (
                <ListRow
                  icon="check-circle"
                  iconColor={colors.success}
                  title="Marcar como hecho"
                  onPress={async () => {
                    setAction(null);
                    await setManualReminderDone(action.reminderId!, true);
                    toast('Recordatorio completado');
                  }}
                />
              )}
              {action.source === 'manual' ? (
                <ListRow icon="pencil" title="Editar recordatorio" onPress={() => { setAction(null); router.push({ pathname: '/reminder/form', params: { id: action.reminderId } }); }} />
              ) : (
                <ListRow icon="tune-variant" title="Cambiar intervalo" onPress={() => { setAction(null); router.push({ pathname: '/vehicle/plan', params: { id: action.vehicleId } }); }} />
              )}
              <ListRow icon="car" title="Ver vehículo" last onPress={() => { setAction(null); router.push({ pathname: '/vehicle/[id]', params: { id: action.vehicleId } }); }} />
            </View>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

/** Options of the car or type filter, each with how many items it would show combined with the other filter. */
function filterOptions(kind: 'vehicle' | 'type', items: UpcomingItem[], vehicles: Vehicle[], filter: AgendaFilter): FilterOption[] {
  const count = (f: AgendaFilter) => items.filter((i) => matchesAgendaFilter(i, f)).length;
  if (kind === 'vehicle') {
    return [
      { key: null, label: 'Todos los autos', icon: 'car-multiple', count: count({ ...filter, vehicleId: null }) },
      ...vehicles.map((v) => ({ key: v.id, label: vehicleLabel(v), subtitle: v.plate ? formatPlate(v.plate, v.country) : undefined, icon: 'car', count: count({ ...filter, vehicleId: v.id }) })),
    ];
  }
  const hasReminders = items.some((i) => i.source === 'manual');
  return [
    { key: null, label: 'Todos los tipos', icon: 'format-list-bulleted', count: count({ ...filter, type: null }) },
    ...PLAN_ITEMS.map((p) => ({ key: p.item, label: findItem(p.item)?.item.label ?? p.item, icon: p.icon, color: p.color, count: count({ ...filter, type: p.item }) })),
    ...(hasReminders ? [{ key: MANUAL_TYPE, label: 'Recordatorios', subtitle: 'VTV, seguro, patente…', icon: 'bell-ring', count: count({ ...filter, type: MANUAL_TYPE }) }] : []),
  ];
}

/** "Pronto · en 12 días · faltan 800 km" — the date itself is in the row's date block. */
function detailOf(it: UpcomingItem): string {
  const d = it.due;
  const parts: string[] = [];
  if (it.estimated) parts.push('Estimado');
  if (d.status === 'overdue') parts.push(dueLabel(it));
  else {
    if (d.status === 'soon') parts.push('Pronto');
    if (d.effectiveDate) parts.push(relativeDays(d.effectiveDate));
    if (d.remainingKm !== null) parts.push(`faltan ${formatInt(d.remainingKm)} km`);
  }
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function AgendaRow({ item, vehicle, onPress }: { item: UpcomingItem; vehicle?: Vehicle; onPress: () => void }) {
  const { colors } = useTheme();
  const visual = upcomingVisual(item, colors.primary);
  const d = item.due;
  const tone = d.status === 'overdue' ? colors.danger : d.status === 'soon' ? colors.warning : null;
  // overdue by km has no meaningful date: the block shows an alert instead
  const shown = d.status === 'overdue' ? (d.dueDate && d.dueDate < today() ? d.dueDate : null) : d.effectiveDate;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${vehicle ? `, ${vehicleLabel(vehicle)}` : ''}${shown ? `, ${formatDay(shown)}` : ''}. ${detailOf(item)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
      })}>
      <View style={{ width: 52, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: (tone ?? colors.primary) + '1A' }}>
        {shown ? (
          <>
            <AppText variant="heading" color={tone ?? colors.text} style={{ fontSize: 22, lineHeight: 26 }}>
              {formatDay(shown, 'd')}
            </AppText>
            <AppText variant="captionStrong" color={tone ?? colors.textMuted} style={{ fontSize: 11, lineHeight: 13, textTransform: 'uppercase' }}>
              {formatDay(shown, 'MMM')}
            </AppText>
          </>
        ) : (
          <Icon name={d.status === 'overdue' ? 'alert' : 'speedometer'} size={24} color={tone ?? colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={visual.icon} size={17} color={visual.color} />
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {item.title}
          </AppText>
        </View>
        {vehicle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {vehicleLabel(vehicle)}
            {vehicle.plate ? ` · ${formatPlate(vehicle.plate, vehicle.country)}` : ''}
          </AppText>
        ) : null}
        <AppText variant="caption" tone={d.status === 'overdue' ? 'danger' : d.status === 'soon' ? 'warning' : 'subtle'} numberOfLines={2}>
          {detailOf(item)}
        </AppText>
      </View>
      <Icon name="chevron-right" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}
