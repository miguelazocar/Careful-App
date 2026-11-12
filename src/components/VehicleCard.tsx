import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';

import type { Vehicle } from '@/db/types';
import { formatKm } from '@/lib/format';
import { photoUri } from '@/services/photos';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { PlateBadge } from './brand';
import { AppText, Icon } from './ui/primitives';

export function VehiclePhoto({ vehicle, style }: { vehicle: Pick<Vehicle, 'photo' | 'colorHex'>; style?: object }) {
  const { colors } = useTheme();
  const uri = photoUri(vehicle.photo);
  if (uri) return <Image source={{ uri }} style={[{ width: '100%', height: '100%' }, style]} contentFit="cover" transition={200} />;
  const tint = vehicle.colorHex ?? colors.primary;
  return (
    <LinearGradient colors={[tint, colors.primaryStrong]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name="car-side" size={64} color="rgba(255,255,255,0.85)" />
    </LinearGradient>
  );
}

/**
 * Garage card: photo on the left melting into the card through a diagonal gradient; on the right,
 * right-aligned and in this order: plate (prominent), brand, model, color and current odometer.
 */
export function VehicleCard({ vehicle, currentKm, onPress }: { vehicle: Vehicle; currentKm: number; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const surface = colors.surface;
  const modelLine = vehicle.model;
  const modelDetail = vehicle.variant;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[vehicle.plate, vehicle.brand, vehicle.model, vehicle.color, formatKm(currentKm)].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        height: 184,
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: surface,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        borderWidth: isDark ? 1 : 0,
        borderColor: colors.border,
        shadowColor: colors.shadow,
        shadowOpacity: isDark ? 0 : 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: isDark ? 0 : 4,
      })}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '62%' }}>
        <VehiclePhoto vehicle={vehicle} />
      </View>
      {/* diagonal fade from the photo into the card surface */}
      <LinearGradient
        pointerEvents="none"
        colors={[surface + '00', surface + '00', surface + 'D9', surface]}
        locations={[0, 0.3, 0.5, 0.62]}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.85 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: '44%' }} />
        <View style={{ flex: 1, paddingVertical: spacing.md, paddingRight: spacing.md, paddingLeft: spacing.xs, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <PlateBadge plate={vehicle.plate} plateStyle={vehicle.plateStyle} country={vehicle.country} size="lg" align="end" />

          <View style={{ alignItems: 'flex-end', alignSelf: 'stretch' }}>
            <AppText variant="overline" tone="primary" align="right" numberOfLines={1}>
              {vehicle.brand}
              {vehicle.year ? ` · ${vehicle.year}` : ''}
            </AppText>
            <AppText variant="heading" align="right" numberOfLines={1} style={{ fontSize: 21, lineHeight: 26 }}>
              {modelLine}
            </AppText>
            {modelDetail ? (
              <AppText variant="caption" tone="muted" align="right" numberOfLines={1}>
                {modelDetail}
              </AppText>
            ) : null}
          </View>

          {vehicle.color ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {vehicle.color}
              </AppText>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: vehicle.colorHex ?? colors.textSubtle, borderWidth: 1, borderColor: colors.border }} />
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {formatKm(currentKm)}
            </AppText>
            <Icon name="speedometer" size={16} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
