import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { brand, radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/theme/tokens';

import { AppText, Icon, type IconName } from './ui/primitives';

const TABS: Record<string, { icon: IconName; iconActive: IconName; label: string }> = {
  index: { icon: 'car-outline' as IconName, iconActive: 'car', label: 'Garage' },
  history: { icon: 'history', iconActive: 'history', label: 'Historial' },
  calendar: { icon: 'calendar-blank-outline', iconActive: 'calendar-month', label: 'Agenda' },
  settings: { icon: 'cog-outline', iconActive: 'cog', label: 'Ajustes' },
};

/**
 * Floating bottom bar with five slots: Garage · Historial · (+) · Agenda · Ajustes.
 * The central "+" is not a screen — it opens the quick-add sheet.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, onAdd }: BottomTabBarProps & { onAdd: () => void }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const renderTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return null;
    const focused = state.index === routeIndex;
    const meta = TABS[route.name];
    if (!meta) return null;
    const label = descriptors[route.key]?.options.title ?? meta.label;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          void Haptics.selectionAsync();
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' }}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: focused ? colors.primarySoft : 'transparent',
          }}>
          <Icon name={focused ? meta.iconActive : meta.icon} size={23} color={focused ? colors.primary : colors.textSubtle} />
        </View>
        <AppText variant="captionStrong" style={{ fontSize: 11, lineHeight: 13 }} color={focused ? colors.primary : colors.textSubtle}>
          {label}
        </AppText>
      </Pressable>
    );
  };

  const order = ['index', 'history', 'calendar', 'settings'].map((n) => state.routes.findIndex((r) => r.name === n));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + TAB_BAR_MARGIN, paddingHorizontal: TAB_BAR_MARGIN }}>
      <View
        style={{
          height: TAB_BAR_HEIGHT,
          borderRadius: radius.xxl,
          backgroundColor: colors.tabBar,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 6,
          borderWidth: isDark ? 1 : 0,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.5 : 0.12,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}>
        {renderTab(order[0])}
        {renderTab(order[1])}
        <View style={{ width: 76, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Registrar actividad"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAdd();
            }}
            style={({ pressed }) => ({
              marginTop: -34,
              width: 66,
              height: 66,
              borderRadius: 33,
              transform: [{ scale: pressed ? 0.94 : 1 }],
              shadowColor: brand.blue,
              shadowOpacity: 0.45,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 14,
              borderWidth: 4,
              borderColor: colors.bg,
              backgroundColor: colors.bg,
            })}>
            <LinearGradient colors={[...brand.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={32} color="#FFFFFF" />
              <View style={{ position: 'absolute', top: 9, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: brand.mint }} />
            </LinearGradient>
          </Pressable>
        </View>
        {renderTab(order[2])}
        {renderTab(order[3])}
      </View>
    </View>
  );
}
