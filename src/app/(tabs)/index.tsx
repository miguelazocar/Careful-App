import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { AppIcon, Wordmark } from '@/components/brand';
import { UpcomingRow } from '@/components/rows';
import { VehicleCard } from '@/components/VehicleCard';
import { Screen } from '@/components/ui/layout';
import { AppText, Button, Icon, IconButton, SectionTitle } from '@/components/ui/primitives';
import { useQuery } from '@/hooks/useQuery';
import { loadUpcoming } from '@/services/upcoming';
import { useSettings } from '@/stores/settings';
import { brand, radius, spacing } from '@/theme/tokens';

export default function GarageScreen() {
  const warnKm = useSettings((s) => s.notifications.warnKm);
  const { data } = useQuery(() => loadUpcoming({ warnKm }), [warnKm]);

  const snapshots = data ? [...data.snapshots.values()] : [];
  const attention = data?.items.filter((i) => i.due.status !== 'ok') ?? [];

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
      <View style={{ gap: spacing.md }}>
        {snapshots.map((s, i) => (
          <Animated.View key={s.vehicle.id} entering={FadeInDown.delay(i * 60).duration(360).easing(Easing.out(Easing.cubic))}>
            <VehicleCard
              vehicle={s.vehicle}
              currentKm={s.currentKm}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: s.vehicle.id } })}
            />
          </Animated.View>
        ))}
      </View>

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
        <Pressable
          onPress={() => router.push('/settings/backup')}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
          <Icon name="cloud-download" size={18} color="rgba(255,255,255,0.85)" />
          <AppText variant="captionStrong" color="rgba(255,255,255,0.85)">
            ¿Ya usabas Careful? Restaurá tu respaldo
          </AppText>
        </Pressable>
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
