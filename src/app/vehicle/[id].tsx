import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlateBadge } from '@/components/brand';
import { RecordRow, UpcomingRow } from '@/components/rows';
import { VehiclePhoto } from '@/components/VehicleCard';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Card, Icon, IconButton, ListRow, SectionTitle } from '@/components/ui/primitives';
import { getMonthlySpend, listRecords } from '@/db/records';
import { deleteVehicle, setVehicleArchived } from '@/db/vehicles';
import { countryName, flagEmoji } from '@/domain/countries';
import { formatPlate } from '@/domain/plate';
import { useQuery } from '@/hooks/useQuery';
import { addMonthsTo, today } from '@/lib/dates';
import { formatAmount, formatInt, formatLiters } from '@/lib/format';
import { deletePhotoFiles } from '@/services/photos';
import { shareVehicleReport } from '@/services/report';
import { loadUpcoming } from '@/services/upcoming';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const FUEL_LABEL: Record<string, string> = { nafta: 'Nafta', diesel: 'Diésel', gnc: 'GNC', hibrido: 'Híbrido', electrico: 'Eléctrico' };

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const warnKm = useSettings((s) => s.notifications.warnKm);
  const [menu, setMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data } = useQuery(async () => {
    const [upcoming, records, spend] = await Promise.all([
      loadUpcoming({ vehicleId: id, warnKm }),
      listRecords({ vehicleId: id }),
      getMonthlySpend('0000-01-01', id),
    ]);
    return { upcoming, records, spend };
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
  const total = data.spend.reduce((s, m) => s + m.cents, 0);
  const yearFrom = addMonthsTo(today(), -12).slice(0, 7);
  const lastYear = data.spend.filter((m) => m.month >= yearFrom).reduce((s, m) => s + m.cents, 0);

  const exportPdf = async () => {
    setMenu(false);
    setExporting(true);
    try {
      await shareVehicleReport(v.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  const remove = () => {
    setMenu(false);
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
    setMenu(false);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 300 }}>
          <VehiclePhoto vehicle={v} />
          <LinearGradient colors={['rgba(7,11,20,0.55)', 'rgba(7,11,20,0)', colors.bg]} locations={[0, 0.35, 1]} style={{ position: 'absolute', inset: 0 }} />
          <View style={{ position: 'absolute', top: insets.top + 8, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton icon="arrow-left" tone="glass" accessibilityLabel="Volver" onPress={() => router.back()} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="pencil" tone="glass" accessibilityLabel="Editar" onPress={() => router.push({ pathname: '/vehicle/form', params: { id: v.id } })} />
              <IconButton icon="dots-vertical" tone="glass" accessibilityLabel="Más opciones" onPress={() => setMenu(true)} />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -54, gap: spacing.lg }}>
          <View style={{ gap: 6 }}>
            <AppText variant="overline" tone="primary">
              {v.brand} {v.year ? `· ${v.year}` : ''} {flagEmoji(v.country)}
            </AppText>
            <AppText variant="display">{v.nickname || v.model}</AppText>
            <AppText variant="body" tone="muted">
              {[v.nickname ? v.model : null, v.variant, v.color].filter(Boolean).join(' · ')}
            </AppText>
            <View style={{ marginTop: 4 }}>
              <PlateBadge plate={v.plate} country={v.country} size="lg" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Stat icon="speedometer" label="Kilometraje" value={formatInt(snap.currentKm)} unit="km" />
            <Stat icon="cash" label="Últimos 12 meses" value={formatAmount(lastYear)} />
            <Stat icon="chart-line" label="Uso promedio" value={snap.dailyKm ? formatInt(snap.dailyKm * 30) : '—'} unit={snap.dailyKm ? 'km/mes' : undefined} />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button style={{ flex: 1 }} label="Registrar" icon="wrench" onPress={() => router.push({ pathname: '/record/form', params: { kind: 'maintenance', vehicleId: v.id } })} />
            <Button style={{ flex: 1 }} label="Kilometraje" icon="speedometer" variant="secondary" onPress={() => router.push({ pathname: '/record/form', params: { kind: 'odometer', vehicleId: v.id } })} />
          </View>

          <View>
            <SectionTitle title="Próximos services" action="Plan" onAction={() => router.push({ pathname: '/vehicle/plan', params: { id: v.id } })} />
            {snap.needsBaseline ? (
              <Card onPress={() => router.push({ pathname: '/record/form', params: { kind: 'maintenance', vehicleId: v.id, item: 'motor.aceite' } })} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Icon name="oil" size={24} color={colors.primary} />
                  <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                    Registrá el último cambio de aceite para que Careful calcule el próximo.
                  </AppText>
                  <Icon name="chevron-right" size={20} color={colors.textSubtle} />
                </View>
              </Card>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              {data.upcoming.items.length ? (
                data.upcoming.items.map((it) => (
                  <UpcomingRow
                    key={it.key}
                    item={it}
                    onPress={() =>
                      it.source === 'service'
                        ? router.push({ pathname: '/record/form', params: { kind: it.categoryKey === 'accesorios' ? 'accessory' : 'maintenance', vehicleId: v.id, item: it.item } })
                        : router.push({ pathname: '/reminder/form', params: { id: it.reminderId } })
                    }
                  />
                ))
              ) : !snap.needsBaseline ? (
                <AppText variant="caption" tone="muted">
                  No hay services programados.
                </AppText>
              ) : null}
            </View>
          </View>

          <View>
            <SectionTitle title="Ficha técnica" />
            <Card padded={false}>
              <Spec icon="card-text-outline" label="Patente" value={v.plate ? `${formatPlate(v.plate, v.country)} · ${countryName(v.country)}` : null} />
              <Spec icon="barcode" label="VIN / chasis" value={v.vin} />
              <Spec icon="engine" label="N° de motor" value={v.engineNumber} />
              <Spec icon="gas-station" label="Combustible" value={v.fuel ? (FUEL_LABEL[v.fuel] ?? v.fuel) : null} />
              <Spec icon="oil" label="Aceite" value={[v.oilType, v.oilLiters ? formatLiters(v.oilLiters) : null].filter(Boolean).join(' · ') || null} />
              <Spec icon="coolant-temperature" label="Refrigerante" value={[v.coolantType, v.coolantLiters ? formatLiters(v.coolantLiters) : null].filter(Boolean).join(' · ') || null} last />
            </Card>
          </View>

          <View>
            <SectionTitle title="Historial" action={data.records.length ? `Total ${formatAmount(total)}` : undefined} />
            {data.records.length ? (
              <View style={{ gap: 6 }}>
                {data.records.slice(0, 30).map((r) => (
                  <RecordRow key={r.id} record={r} showVehicle={false} onPress={() => router.push({ pathname: '/record/[id]', params: { id: r.id } })} />
                ))}
              </View>
            ) : (
              <Card>
                <AppText variant="caption" tone="muted">
                  Todavía no hay registros. Tocá “Registrar” para cargar el primero.
                </AppText>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={v.nickname || `${v.brand} ${v.model}`}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
          <ListRow icon="file-pdf-box" title={exporting ? 'Generando…' : 'Exportar historial (PDF)'} subtitle="Ideal para mostrar al vender el auto" onPress={() => void exportPdf()} />
          <ListRow icon="calendar-plus" title="Agregar recordatorio" subtitle="VTV, seguro, patente…" onPress={() => { setMenu(false); router.push({ pathname: '/reminder/form', params: { vehicleId: v.id } }); }} />
          <ListRow icon="tune-variant" title="Plan de mantenimiento" subtitle="Intervalos por km y por tiempo" onPress={() => { setMenu(false); router.push({ pathname: '/vehicle/plan', params: { id: v.id } }); }} />
          <ListRow icon="archive-outline" title="Archivar" subtitle="Lo vendiste o ya no lo usás" onPress={archive} />
          <ListRow icon="delete-outline" title="Eliminar vehículo" danger last onPress={remove} />
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ icon, label, value, unit }: { icon: string; label: string; value: string; unit?: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, padding: spacing.sm, gap: 4 }}>
      <Icon name={icon} size={18} color={colors.primary} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <AppText variant="number" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 19, flexShrink: 1 }}>
          {value}
        </AppText>
        {unit ? (
          <AppText variant="caption" tone="muted" style={{ fontSize: 11 }}>
            {unit}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" tone="muted" style={{ fontSize: 11 }} numberOfLines={1}>
        {label}
      </AppText>
    </Card>
  );
}

function Spec({ icon, label, value, last }: { icon: string; label: string; value: string | null; last?: boolean }) {
  return <ListRow icon={icon} title={label} subtitle={value ?? 'Sin datos'} last={last} />;
}

