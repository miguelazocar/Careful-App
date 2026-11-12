import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmIdentity } from '@/components/AuthPrompt';
import { BrandLogo } from '@/components/BrandLogo';
import { monthsUnit } from '@/components/IntervalFields';
import { openQuickRecord } from '@/components/QuickRecord';
import { RecordRow, UpcomingRow } from '@/components/rows';
import { VehiclePhoto } from '@/components/VehicleCard';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Card, Icon, IconButton, ListRow } from '@/components/ui/primitives';
import { listRecords } from '@/db/records';
import { getServiceRules } from '@/db/reminders';
import type { Vehicle } from '@/db/types';
import { deleteVehicle, setVehicleArchived } from '@/db/vehicles';
import { flagEmoji } from '@/domain/countries';
import { CORE_ITEM } from '@/domain/maintenance';
import { dueText } from '@/domain/notification-plan';
import { formatPlate } from '@/domain/plate';
import { resolveInterval, type Interval, type UpcomingItem } from '@/domain/schedule';
import { COOLANT_BASES, coolantMix, fuelLabel, OIL_BASES } from '@/domain/vehicle-specs';
import { useQuery } from '@/hooks/useQuery';
import { formatDay } from '@/lib/dates';
import { formatAmount, formatKm } from '@/lib/format';
import { deletePhotoFiles } from '@/services/photos';
import { shareVehicleReport } from '@/services/report';
import { loadUpcoming } from '@/services/upcoming';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Tab = 'vehiculo' | 'aceite' | 'refrigerante';
const TABS: { key: Tab; label: string }[] = [
  { key: 'vehiculo', label: 'Vehículo' },
  { key: 'aceite', label: 'Aceite' },
  { key: 'refrigerante', label: 'Refrigerante' },
];
/** Wizard step that edits each tab. */
const EDIT_STEP: Record<Tab, number> = { vehiculo: 0, aceite: 2, refrigerante: 3 };
const TAB_HEIGHT = 318;

const liters = (n: number | null | undefined) => (n ? `${String(Math.round(n * 100) / 100).replace('.', ',')} L` : null);

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const warnKm = useSettings((s) => s.notifications.warnKm);
  const [tab, setTab] = useState<Tab>('vehiculo');
  const [sheet, setSheet] = useState<null | 'menu' | 'services' | 'history'>(null);
  const [exporting, setExporting] = useState(false);

  const { data } = useQuery(async () => {
    const [upcoming, records, rules] = await Promise.all([loadUpcoming({ vehicleId: id, warnKm }), listRecords({ vehicleId: id }), getServiceRules(id)]);
    return { upcoming, records, oilPlan: resolveInterval(CORE_ITEM, rules) };
  }, [id, warnKm]);

  const snap = data?.upcoming.snapshots.get(id);
  if (!data) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!snap) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 12 }}>
        <AppText tone="muted">Este vehículo ya no existe.</AppText>
        <Button label="Volver" onPress={() => router.back()} />
      </View>
    );
  }
  const v = snap.vehicle;
  const pending = data.upcoming.items.filter((i) => i.due.status !== 'ok').length;
  const total = data.records.reduce((s, r) => s + (r.amountCents ?? 0), 0);

  const edit = async () => {
    if (!(await confirmIdentity('Confirmá que sos vos para editar los datos del vehículo.'))) return;
    router.push({ pathname: '/vehicle/form', params: { id: v.id, step: String(EDIT_STEP[tab]) } });
  };

  const exportPdf = async () => {
    setSheet(null);
    setExporting(true);
    try {
      await shareVehicleReport(v.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    setSheet(null);
    if (!(await confirmIdentity('Confirmá que sos vos para eliminar el vehículo.'))) return;
    Alert.alert('Eliminar vehículo', `Se borrarán ${v.brand} ${v.model} y sus ${data.records.length} registros. Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          deletePhotoFiles(await deleteVehicle(v.id));
          toast('Vehículo eliminado');
          router.back();
        },
      },
    ]);
  };

  const archive = () => {
    setSheet(null);
    Alert.alert('Archivar vehículo', 'Lo ocultamos del garage y de los avisos, pero conservás su historial. Podés restaurarlo desde Ajustes.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: async () => {
          await setVehicleArchived(v.id, true);
          toast('Vehículo archivado');
          router.back();
        },
      },
    ]);
  };

  const go = (pathname: '/record/form' | '/reminder/form' | '/vehicle/plan', params: Record<string, string>) => {
    setSheet(null);
    router.push({ pathname, params } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: insets.bottom + spacing.sm }}>
      {/* Photo */}
      <View style={{ flex: 1, minHeight: 150 }}>
        <VehiclePhoto vehicle={v} />
        <LinearGradient colors={['rgba(7,11,20,0.55)', 'rgba(7,11,20,0)', 'rgba(7,11,20,0.75)']} locations={[0, 0.35, 1]} style={{ position: 'absolute', inset: 0 }} />
        <View style={{ position: 'absolute', top: insets.top + 8, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
          <IconButton icon="arrow-left" tone="glass" accessibilityLabel="Volver" onPress={() => router.back()} />
          <IconButton icon="dots-vertical" tone="glass" accessibilityLabel="Más opciones" onPress={() => setSheet('menu')} />
        </View>
        <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl + 8, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <BrandLogo brandId={v.brandId} brand={v.brand} size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="overline" color="rgba(255,255,255,0.85)" numberOfLines={1}>
              {v.brand}
              {v.year ? ` · ${v.year}` : ''}
            </AppText>
            <AppText variant="display" color="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 30, lineHeight: 36 }}>
              {v.model}
            </AppText>
            {v.variant ? (
              <AppText variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                {v.variant}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      {/* Data card with tabs */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl, gap: spacing.sm }}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs, paddingRight: spacing.sm }}>
            <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 }}>
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={{ flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : 'transparent' }}>
                    <AppText variant="captionStrong" color={active ? '#FFFFFF' : colors.textMuted} numberOfLines={1} adjustsFontSizeToFit>
                      {t.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <IconButton icon="pencil" tone="primary" accessibilityLabel="Editar" onPress={() => void edit()} />
          </View>
          <Animated.View key={tab} entering={FadeIn.duration(180)} style={{ height: TAB_HEIGHT, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
            {tab === 'vehiculo' ? (
              <VehicleTab v={v} km={snap.currentKm} spentCents={total} nextOil={data.upcoming.items.find((i) => i.item === CORE_ITEM)} />
            ) : tab === 'aceite' ? (
              <OilTab v={v} plan={data.oilPlan} next={data.upcoming.items.find((i) => i.item === CORE_ITEM)} />
            ) : (
              <CoolantTab v={v} />
            )}
          </Animated.View>
        </Card>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Action icon="plus" label="Evento" primary onPress={() => go('/record/form', { kind: 'maintenance', vehicleId: v.id })} />
          <Action icon="speedometer" label="Kilometraje" onPress={() => openQuickRecord({ kind: 'odometer', vehicleId: v.id })} />
          <Action icon="calendar-clock" label="Services" badge={pending || undefined} onPress={() => setSheet('services')} />
          <Action icon="history" label="Historial" onPress={() => setSheet('history')} />
        </View>
      </View>

      <Sheet visible={sheet === 'services'} onClose={() => setSheet(null)} title="Próximos services">
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.sm }}>
          {data.upcoming.items.length ? (
            data.upcoming.items.map((it) => (
              <UpcomingRow
                key={it.key}
                item={it}
                onPress={() =>
                  it.source !== 'service'
                    ? go('/reminder/form', { id: it.reminderId ?? '' })
                    : go('/record/form', { kind: 'maintenance', vehicleId: v.id, item: it.item ?? '' })
                }
              />
            ))
          ) : (
            <AppText variant="caption" tone="muted">
              No hay services programados.
            </AppText>
          )}
          <Button label="Plan de mantenimiento" icon="tune-variant" variant="secondary" onPress={() => go('/vehicle/plan', { id: v.id })} />
        </ScrollView>
      </Sheet>

      <Sheet visible={sheet === 'history'} onClose={() => setSheet(null)} title={data.records.length ? `Historial · ${formatAmount(total)}` : 'Historial'}>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 6 }}>
          {data.records.length ? (
            data.records.map((r) => (
              <RecordRow
                key={r.id}
                record={r}
                showVehicle={false}
                onPress={() => {
                  setSheet(null);
                  router.push({ pathname: '/record/[id]', params: { id: r.id } });
                }}
              />
            ))
          ) : (
            <AppText variant="caption" tone="muted">
              Todavía no hay registros. Tocá «Evento» para cargar el primero.
            </AppText>
          )}
        </ScrollView>
      </Sheet>

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={`${v.brand} ${v.model}`}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
          <ListRow icon="file-pdf-box" title={exporting ? 'Generando…' : 'Informe del vehículo (PDF)'} subtitle="Resumen, ficha técnica e historial: ideal para vender" onPress={() => void exportPdf()} />
          <ListRow icon="calendar-plus" title="Agregar recordatorio" subtitle="VTV, seguro, patente…" onPress={() => go('/reminder/form', { vehicleId: v.id })} />
          <ListRow icon="tune-variant" title="Plan de mantenimiento" subtitle="Intervalos por km y por tiempo" onPress={() => go('/vehicle/plan', { id: v.id })} />
          <ListRow icon="archive-outline" title="Archivar" subtitle="Lo vendiste o ya no lo usás" onPress={archive} />
          <ListRow icon="delete-outline" title="Eliminar vehículo" danger last onPress={() => void remove()} />
        </View>
      </Sheet>
    </View>
  );
}

/* --------------------------------- Tabs --------------------------------- */

function VehicleTab({ v, km, spentCents, nextOil }: { v: Vehicle; km: number; spentCents: number; nextOil?: UpcomingItem }) {
  const { colors } = useTheme();
  const oil = nextOil?.due;
  const oilTone = oil?.status === 'overdue' ? colors.danger : oil?.status === 'soon' ? colors.warning : colors.primary;
  // the next oil change by km (what the odometer shows); by date when the plan has no km interval
  const oilValue = oil ? (oil.dueKm !== null ? formatKm(oil.dueKm) : oil.dueDate ? formatDay(oil.dueDate) : null) : null;
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Row>
        <Cell label="Total gastado" value={formatAmount(spentCents)} accent={colors.primary} />
        <Cell label="Kilometraje" value={formatKm(km)} accent={colors.primary} />
        <Cell label={oil?.status === 'overdue' ? 'Aceite vencido' : 'Próximo aceite'} value={oilValue} accent={oilTone} />
      </Row>
      <Row>
        <Cell label="Patente / placa" value={v.plate ? `${flagEmoji(v.country)} ${formatPlate(v.plate, v.country)}` : null} />
        <Cell label="Marca" value={v.brand} left={<BrandLogo brandId={v.brandId} brand={v.brand} size={20} />} />
      </Row>
      <Row>
        <Cell label="Modelo" value={v.model} />
        <Cell label="Variante / versión" value={v.variant} />
      </Row>
      <Row>
        <Cell label="Serial de chasis" value={v.vin} />
        <Cell label="Serial de motor" value={v.engineNumber} />
      </Row>
      <Row>
        <Cell label="Año" value={v.year ? String(v.year) : null} />
        <Cell
          label="Color"
          value={v.color}
          left={v.color ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: v.colorHex ?? colors.textSubtle, borderWidth: 1, borderColor: colors.border }} /> : undefined}
        />
        <Cell label="Combustible" value={fuelLabel(v.fuel)} />
      </Row>
    </View>
  );
}

function OilTab({ v, plan, next }: { v: Vehicle; plan: Interval; next?: UpcomingItem }) {
  const { colors } = useTheme();
  const every = [plan.intervalKm ? formatKm(plan.intervalKm) : null, plan.intervalMonths ? `${plan.intervalMonths} ${monthsUnit(plan.intervalMonths)}` : null].filter(Boolean).join(' o ');
  const tone = next?.due.status === 'overdue' ? colors.danger : next?.due.status === 'soon' ? colors.warning : colors.primary;
  const left =
    next?.due.status === 'overdue'
      ? 'Vencido'
      : next?.due.remainingKm !== null && next?.due.remainingKm !== undefined
        ? `Faltan ${formatKm(next.due.remainingKm)}`
        : next?.due.daysLeft !== null && next?.due.daysLeft !== undefined
          ? `Faltan ${next.due.daysLeft} días`
          : null;
  return (
    <View style={{ flex: 1, gap: spacing.xs, paddingTop: spacing.xxs }}>
      <BaseSelector options={OIL_BASES} value={v.oilBase} />
      <Row>
        <Cell label="Cantidad (con filtro)" value={liters(v.oilLiters)} big />
        <Cell label="Versión" value={v.oilType} />
      </Row>
      <Row>
        <Cell label="Marca" value={v.oilBrand} />
        <Cell label="Modelo" value={v.oilModel} />
      </Row>
      <View style={{ flex: 1.25, justifyContent: 'center', gap: 6, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.primarySoft }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="calendar-sync" size={16} color={colors.primary} />
          <AppText variant="captionStrong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1 }}>
            {every ? `Cada ${every}` : 'Sin intervalo de cambio'}
          </AppText>
          {left ? (
            <AppText variant="captionStrong" color={tone} numberOfLines={1}>
              {left}
            </AppText>
          ) : null}
        </View>
        {next ? (
          <>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, Math.round(next.due.progress * 100))}%`, height: 6, borderRadius: 3, backgroundColor: tone }} />
            </View>
            <AppText variant="caption" tone="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 12 }}>
              {next.estimated ? 'Estimado: ' : 'Próximo: '}
              {dueText(next.due)}
            </AppText>
          </>
        ) : null}
      </View>
    </View>
  );
}

function CoolantTab({ v }: { v: Vehicle }) {
  const { colors } = useTheme();
  const mix = coolantMix(v.coolantLiters, v.coolantConcentration);
  return (
    <View style={{ flex: 1, gap: spacing.sm, paddingTop: spacing.xxs }}>
      <BaseSelector options={COOLANT_BASES} value={v.coolantBase} />
      <Row>
        <Cell label="Cantidad total" value={liters(v.coolantLiters)} big />
        <Cell label="Concentración" value={v.coolantConcentration ? `${v.coolantConcentration}%` : null} big />
      </Row>
      <View style={{ gap: 6, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
        {mix && v.coolantConcentration ? (
          <>
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#9EC5FF' }}>
              <View style={{ width: `${v.coolantConcentration}%`, backgroundColor: colors.primary }} />
            </View>
            <AppText variant="captionStrong" numberOfLines={2}>
              {liters(mix.coolant)} de refrigerante + {liters(mix.water)} de agua desmineralizada
            </AppText>
          </>
        ) : (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            Cargá la cantidad total y la concentración para ver la mezcla de refrigerante y agua.
          </AppText>
        )}
      </View>
      <Row>
        <Cell label="Marca" value={v.coolantBrand} />
        <Cell label="Modelo" value={v.coolantModel} />
      </Row>
      <Row>
        <Cell label="Versión" value={v.coolantType} />
      </Row>
    </View>
  );
}

/* ------------------------------ Building blocks ------------------------------ */

function Row({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, flexDirection: 'row', gap: spacing.xs }}>{children}</View>;
}

/** A label / value box. `accent` highlights it (tinted background, value in that color). */
function Cell({ label, value, left, big, accent }: { label: string; value: string | null | undefined; left?: ReactNode; big?: boolean; accent?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: accent ? accent + '1A' : colors.surfaceAlt }}>
      <AppText variant="caption" tone="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 11 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {left}
        <AppText
          variant={big ? 'number' : 'bodyStrong'}
          tone={value ? 'default' : 'subtle'}
          color={value && accent ? accent : undefined}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[{ flexShrink: 1 }, big ? { fontSize: 22 } : null]}>
          {value || '—'}
        </AppText>
      </View>
    </View>
  );
}

/** The three base types, the vehicle's one highlighted. */
function BaseSelector({ options, value }: { options: { value: string; label: string }[]; value: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <View
            key={o.value}
            style={{
              flex: 1,
              height: 36,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 4,
              backgroundColor: active ? colors.primary : 'transparent',
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
            }}>
            {active ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
            <AppText variant="captionStrong" color={active ? '#FFFFFF' : colors.textSubtle} numberOfLines={1} adjustsFontSizeToFit>
              {o.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function Action({ icon, label, onPress, primary, badge }: { icon: string; label: string; onPress: () => void; primary?: boolean; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 64,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: primary ? colors.primary : colors.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <Icon name={icon} size={22} color={primary ? '#FFFFFF' : colors.primary} />
      <AppText variant="caption" color={primary ? '#FFFFFF' : colors.text} numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </AppText>
      {badge ? (
        <View style={{ position: 'absolute', top: 6, right: 10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="captionStrong" color="#FFFFFF" style={{ fontSize: 11 }}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
