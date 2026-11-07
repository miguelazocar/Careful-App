import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { TabBar } from '@/components/TabBar';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Icon } from '@/components/ui/primitives';
import { listVehicles } from '@/db/vehicles';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/ThemeProvider';
import { brand, radius, spacing } from '@/theme/tokens';

export default function TabsLayout() {
  const [quickAdd, setQuickAdd] = useState(false);
  return (
    <>
      <Tabs tabBar={(props) => <TabBar {...props} onAdd={() => setQuickAdd(true)} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" options={{ title: 'Garage' }} />
        <Tabs.Screen name="history" options={{ title: 'Historial' }} />
        <Tabs.Screen name="calendar" options={{ title: 'Agenda' }} />
        <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
      </Tabs>
      <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
    </>
  );
}

const OPTIONS = [
  {
    kind: 'maintenance',
    title: 'Mantenimiento o reparación',
    subtitle: 'Service, cambio de aceite, frenos, lavado…',
    icon: 'wrench',
    colors: brand.gradient,
  },
  {
    kind: 'accessory',
    title: 'Accesorio',
    subtitle: 'Luces, estéreo, polarizado, llantas, matafuego…',
    icon: 'star-four-points',
    colors: ['#2EE8B6', '#0FA57D'],
  },
  {
    kind: 'odometer',
    title: 'Solo kilometraje',
    subtitle: 'Actualizá el odómetro para afinar los avisos',
    icon: 'speedometer',
    colors: ['#334155', '#1D2633'],
  },
] as const;

function QuickAddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { data: vehicles } = useQuery(() => listVehicles(), []);
  const hasVehicles = (vehicles?.length ?? 0) > 0;

  return (
    <Sheet visible={visible} onClose={onClose} title={hasVehicles ? '¿Qué querés registrar?' : 'Primero, tu auto'}>
      {hasVehicles ? (
        <View style={{ gap: spacing.sm }}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.kind}
              accessibilityRole="button"
              accessibilityLabel={o.title}
              onPress={() => {
                onClose();
                router.push({ pathname: '/record/form', params: { kind: o.kind } });
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.xl,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}>
              <LinearGradient colors={[...o.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={o.icon} size={28} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <AppText variant="subheading">{o.title}</AppText>
                <AppText variant="caption" tone="muted">
                  {o.subtitle}
                </AppText>
              </View>
              <Icon name="chevron-right" size={22} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <AppText tone="muted">Para registrar mantenimientos, accesorios o kilometraje necesitás dar de alta al menos un vehículo.</AppText>
          <Button
            label="Agregar mi auto"
            icon="car-2-plus"
            size="lg"
            onPress={() => {
              onClose();
              router.push('/vehicle/form');
            }}
          />
        </View>
      )}
    </Sheet>
  );
}
