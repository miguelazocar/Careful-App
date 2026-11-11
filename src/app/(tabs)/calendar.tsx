import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { openQuickRecord } from '@/components/QuickRecord';
import { UpcomingRow } from '@/components/rows';
import { Sheet } from '@/components/ui/overlays';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, EmptyState, Grid, IconButton, ListRow } from '@/components/ui/primitives';
import { setManualReminderDone } from '@/db/reminders';
import type { UpcomingItem } from '@/domain/schedule';
import { useQuery } from '@/hooks/useQuery';
import { addMonthsTo, daysBetween, formatDay, formatMonth, monthStart, parseDay, today, toDay } from '@/lib/dates';
import { loadUpcoming, vehicleLabel } from '@/services/upcoming';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function CalendarScreen() {
  const { colors } = useTheme();
  const warnKm = useSettings((s) => s.notifications.warnKm);
  const [month, setMonth] = useState(monthStart(today()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [action, setAction] = useState<UpcomingItem | null>(null);
  const { data } = useQuery(() => loadUpcoming({ warnKm }), [warnKm]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const byDay = useMemo(() => {
    const m = new Map<string, UpcomingItem[]>();
    for (const it of items) {
      const d = it.due.status === 'overdue' ? null : it.due.effectiveDate;
      if (!d) continue;
      m.set(d, [...(m.get(d) ?? []), it]);
    }
    return m;
  }, [items]);

  const overdue = items.filter((i) => i.due.status === 'overdue');
  const upcoming = items.filter((i) => i.due.status !== 'overdue');
  const dayItems = selectedDay ? (byDay.get(selectedDay) ?? []) : null;

  const vehicleOf = (id: string) => data?.snapshots.get(id)?.vehicle;
  const noVehicles = data && data.snapshots.size === 0;

  return (
    <Screen
      tabBar
      header={
        <Header
          large
          title="Agenda"
          subtitle="Próximos services y recordatorios"
          right={!noVehicles ? <IconButton icon="bell-plus" tone="primary" accessibilityLabel="Nuevo recordatorio" onPress={() => router.push('/reminder/form')} /> : undefined}
        />
      }>
      {noVehicles ? (
        <EmptyState icon="calendar-month" title="Nada agendado todavía" message="Agregá un auto y registrá su último service: Careful calcula el próximo por fecha o kilometraje." action={<Button label="Agregar auto" icon="car-2-plus" onPress={() => router.push('/vehicle/form')} />} />
      ) : (
        <>
          <MonthGrid month={month} onMonth={setMonth} byDay={byDay} selected={selectedDay} onSelect={(d) => setSelectedDay(d === selectedDay ? null : d)} />

          {dayItems ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="subheading">{formatDay(selectedDay!, "EEEE d 'de' MMMM")}</AppText>
              {dayItems.length ? (
                dayItems.map((it) => <UpcomingRow key={it.key} item={it} vehicle={vehicleOf(it.vehicleId)} onPress={() => setAction(it)} />)
              ) : (
                <AppText variant="caption" tone="muted">
                  Nada para este día.
                </AppText>
              )}
            </View>
          ) : null}

          {overdue.length ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="heading" tone="danger">
                Vencidos
              </AppText>
              {overdue.map((it) => (
                <UpcomingRow key={it.key} item={it} vehicle={vehicleOf(it.vehicleId)} onPress={() => setAction(it)} />
              ))}
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading">Próximos</AppText>
            {upcoming.length ? (
              upcoming.map((it) => <UpcomingRow key={it.key} item={it} vehicle={vehicleOf(it.vehicleId)} onPress={() => setAction(it)} />)
            ) : (
              <Card>
                <AppText variant="caption" tone="muted">
                  Registrá un cambio de aceite u otro service y Careful agenda el próximo automáticamente.
                </AppText>
              </Card>
            )}
          </View>
        </>
      )}

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
                    if (action.categoryKey === 'accesorios') openQuickRecord({ kind: 'accessory', vehicleId: action.vehicleId, title: action.title });
                    else router.push({ pathname: '/record/form', params: { kind: 'maintenance', vehicleId: action.vehicleId, item: action.item } });
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

function MonthGrid({ month, onMonth, byDay, selected, onSelect }: { month: string; onMonth: (m: string) => void; byDay: Map<string, UpcomingItem[]>; selected: string | null; onSelect: (d: string) => void }) {
  const { colors } = useTheme();
  const first = parseDay(month);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const todayStr = today();
  const cells: (string | null)[] = [...Array<null>(offset).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDay(new Date(first.getFullYear(), first.getMonth(), d)));
  while (cells.length % 7) cells.push(null);

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-left" tone="clear" size={38} accessibilityLabel="Mes anterior" onPress={() => onMonth(addMonthsTo(month, -1))} />
        <Pressable onPress={() => onMonth(monthStart(todayStr))}>
          <AppText variant="subheading" style={{ textTransform: 'capitalize' }}>
            {formatMonth(month.slice(0, 7))}
          </AppText>
        </Pressable>
        <IconButton icon="chevron-right" tone="clear" size={38} accessibilityLabel="Mes siguiente" onPress={() => onMonth(addMonthsTo(month, 1))} />
      </View>
      <Grid columns={7} gap={0}>
        {WEEKDAYS.map((w, i) => (
          <AppText key={`w${i}`} variant="captionStrong" tone="subtle" align="center" style={{ fontSize: 12 }}>
            {w}
          </AppText>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ height: 44 }} />;
          const events = byDay.get(d) ?? [];
          const isToday = d === todayStr;
          const isSel = d === selected;
          const past = daysBetween(todayStr, d) < 0;
          const dot = events.some((e) => e.due.status === 'soon') ? colors.warning : colors.primary;
          return (
            <Pressable key={d} onPress={() => onSelect(d)} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${formatDay(d)}${events.length ? `, ${events.length} eventos` : ''}`}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSel ? colors.primary : isToday ? colors.primarySoft : 'transparent',
                }}>
                <AppText variant={isToday || events.length ? 'captionStrong' : 'caption'} color={isSel ? '#fff' : past ? colors.textSubtle : colors.text}>
                  {Number(d.slice(8))}
                </AppText>
              </View>
              {events.length ? <View style={{ position: 'absolute', bottom: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: isSel ? '#fff' : dot }} /> : null}
            </Pressable>
          );
        })}
      </Grid>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'center' }}>
        <Legend color={colors.primary} label="Programado" />
        <Legend color={colors.warning} label="Pronto" />
      </View>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <AppText variant="caption" tone="muted" style={{ fontSize: 12 }}>
        {label}
      </AppText>
    </View>
  );
}

