import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';

import type { Vehicle } from '@/db/types';
import { flagEmoji } from '@/domain/countries';
import type { UpcomingItem } from '@/domain/schedule';
import { relativeDays } from '@/lib/dates';
import { formatInt, formatKm } from '@/lib/format';
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

/** Short "when" for the card: the condition that makes it urgent (km or date) comes first. */
function nextLabel(it: UpcomingItem): string {
  const d = it.due;
  if (d.status === 'overdue') return 'vencido';
  const kmIsUrgent = d.status === 'soon' && d.remainingKm !== null && (d.daysLeft === null || d.daysLeft > 30);
  if (kmIsUrgent || !d.effectiveDate) return `faltan ${formatInt(d.remainingKm ?? 0)} km`;
  return relativeDays(d.effectiveDate);
}

/**
 * Garage card: photo on the left melting into the card through a diagonal gradient,
 * registration data on the right (brand, model, color, plate, country flag).
 */
export function VehicleCard({ vehicle, currentKm, next, onPress }: { vehicle: Vehicle; currentKm: number; next?: UpcomingItem; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const surface = colors.surface;
  const statusColor = next?.due.status === 'overdue' ? colors.danger : next?.due.status === 'soon' ? colors.warning : colors.success;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.brand} ${vehicle.model}`}
      style={({ pressed }) => ({
        height: 168,
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
        <View style={{ width: '44%', justifyContent: 'flex-end', padding: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(7,11,20,0.55)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Icon name="speedometer" size={13} color="#FFFFFF" />
            <AppText variant="captionStrong" color="#FFFFFF" style={{ fontSize: 12 }}>
              {formatKm(currentKm)}
            </AppText>
          </View>
        </View>
        <View style={{ flex: 1, paddingVertical: spacing.md, paddingRight: spacing.md, paddingLeft: spacing.xs, justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText variant="overline" tone="primary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {vehicle.brand}
                {vehicle.year ? ` · ${vehicle.year}` : ''}
              </AppText>
              <AppText style={{ fontSize: 13 }}>{flagEmoji(vehicle.country)}</AppText>
            </View>
            <AppText variant="heading" numberOfLines={1} style={{ fontSize: 21, lineHeight: 26 }}>
              {vehicle.nickname || vehicle.model}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {vehicle.nickname ? `${vehicle.model} ${vehicle.variant ?? ''}` : (vehicle.variant ?? ' ')}
            </AppText>
            {vehicle.color ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: vehicle.colorHex ?? colors.textSubtle, borderWidth: 1, borderColor: colors.border }} />
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {vehicle.color}
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 6 }}>
            <PlateBadge plate={vehicle.plate} country={vehicle.country} size="sm" />
            {next ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
                <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
                  {next.title} · {nextLabel(next)}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
