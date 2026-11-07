import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppIcon, Wordmark } from '@/components/brand';
import { UpcomingRow } from '@/components/rows';
import { VehicleCard } from '@/components/VehicleCard';
import { Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Icon, IconButton, SectionTitle } from '@/components/ui/primitives';
import { getVehicleStats } from '@/db/records';
import { useQuery } from '@/hooks/useQuery';
import { formatAmount } from '@/lib/format';
import { loadUpcoming } from '@/services/upcoming';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { brand, radius, spacing } from '@/theme/tokens';

export default function GarageScreen() {
  const { colors } = useTheme();
  const warnKm = useSettings((s) => s.notifications.warnKm);
  const year = new Date().getFullYear();
  const { data } = useQuery(async () => {
    const [upcoming, stats] = await Promise.all([loadUpcoming({ warnKm }), getVehicleStats(year)]);
    return { ...upcoming, stats };
  }, [warnKm, year]);

  const snapshots = data ? [...data.snapshots.values()] : [];
  const attention = data?.items.filter((i) => i.due.status !== 'ok') ?? [];
  const yearTotal = data?.stats.reduce((s, x) => s + (x.yearCents ?? 0), 0) ?? 0;

  if (data && snapshots.length === 0) return <Welcome />;

  return (
    <Screen
      tabBar
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <Wordmark height={30} />
          <IconButton icon="plus" tone="primary" accessibilityLabel="Agregar vehículo" onPress={() => router.push('/vehicle/form')} />
        </View>
      }>
      {snapshots.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <SummaryTile icon="garage" label={snapshots.length === 1 ? 'Vehículo' : 'Vehículos'} value={String(snapshots.length)} />
          <SummaryTile icon="bell-ring" label="Pendientes" value={String(attention.length)} tint={attention.length ? colors.warning : colors.success} />
          <SummaryTile icon="cash" label={`Gastos ${year}`} value={formatAmount(yearTotal)} />
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        {snapshots.map((s, i) => (
          <Animated.View key={s.vehicle.id} entering={FadeInDown.delay(i * 60).springify().damping(18)}>
            <VehicleCard
              vehicle={s.vehicle}
              currentKm={s.currentKm}
              next={data?.items.find((it) => it.vehicleId === s.vehicle.id)}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: s.vehicle.id } })}
            />
          </Animated.View>
        ))}
      </View>

      {snapshots.some((s) => s.needsBaseline) ? (
        <Card onPress={() => {
          const s = snapshots.find((x) => x.needsBaseline)!;
          router.push({ pathname: '/record/form', params: { kind: 'maintenance', vehicleId: s.vehicle.id, item: 'motor.aceite' } });
        }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="oil" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Activá los avisos de service</AppText>
              <AppText variant="caption" tone="muted">
                Registrá el último cambio de aceite de {snapshots.find((x) => x.needsBaseline)?.vehicle.model} y Careful agenda el próximo.
              </AppText>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textSubtle} />
          </View>
        </Card>
      ) : null}

      {attention.length ? (
        <View>
          <SectionTitle title="Requieren atención" action="Ver agenda" onAction={() => router.push('/calendar')} />
          <View style={{ gap: spacing.sm }}>
            {attention.slice(0, 3).map((it) => (
              <UpcomingRow
                key={it.key}
                item={it}
                compact
                vehicle={data?.snapshots.get(it.vehicleId)?.vehicle}
                onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: it.vehicleId } })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function SummaryTile({ icon, label, value, tint }: { icon: string; label: string; value: string; tint?: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, padding: spacing.sm, gap: 6 }}>
      <Icon name={icon} size={20} color={tint ?? colors.primary} />
      <AppText variant="number" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 20 }}>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </AppText>
    </Card>
  );
}

function Welcome() {
  return (
    <Screen tabBar contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <LinearGradient colors={['#0B1B3F', '#0547C9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.lg, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: 110, borderWidth: 18, borderColor: brand.mint, opacity: 0.18 }} />
        <AppIcon size={76} />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="display" color="#FFFFFF">
            Tu auto,{'\n'}toda su historia{'\n'}en un solo lugar.
          </AppText>
          <AppText variant="body" color="rgba(255,255,255,0.8)">
            Registrá services, reparaciones, accesorios y kilometraje. Careful te avisa antes de cada mantenimiento.
          </AppText>
        </View>
        <Button label="Agregar mi primer auto" icon="car-2-plus" variant="mint" size="lg" onPress={() => router.push('/vehicle/form')} />
      </LinearGradient>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {[
          ['shield-lock', 'Tus datos quedan en tu teléfono'],
          ['calendar-clock', 'Avisos por fecha o kilometraje, lo que ocurra primero'],
          ['file-pdf-box', 'Historial exportable para cuando vendas el auto'],
        ].map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name={icon} size={20} color={brand.blue} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              {text}
            </AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}
