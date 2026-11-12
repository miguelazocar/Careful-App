import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import type { LogRecordFull, Vehicle } from '@/db/types';
import { ACCESSORY_ICONS, accessoryTag, findCategory, itemName, planItem } from '@/domain/maintenance';
import type { UpcomingItem } from '@/domain/schedule';
import { formatDay, relativeDays } from '@/lib/dates';
import { formatAmount, formatInt, formatKm } from '@/lib/format';
import { photoUri } from '@/services/photos';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText, Icon, Pill, ProgressBar } from './ui/primitives';

export function recordTitle(r: Pick<LogRecordFull, 'kind' | 'items'>): string {
  if (r.kind === 'odometer') return 'Actualización de kilometraje';
  const labels = r.items.map(itemName);
  if (!labels.length) return r.kind === 'accessory' ? 'Accesorio' : 'Mantenimiento';
  return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
}

export function recordVisual(r: Pick<LogRecordFull, 'kind' | 'items'>, primary: string): { icon: string; color: string } {
  if (r.kind === 'odometer') return { icon: 'speedometer', color: primary };
  const first = r.items[0];
  if (r.kind === 'accessory') return { icon: (first && ACCESSORY_ICONS[first.item]) ?? 'star-four-points', color: '#14C895' };
  const cat = first ? findCategory(first.category) : undefined;
  return { icon: cat?.icon ?? 'wrench', color: cat?.color ?? primary };
}

/** Small "# Estéreo" pill for an accessory's tag. */
export function TagPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 20, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: color + '1F' }}>
      <Icon name="tag" size={11} color={color} />
      <AppText variant="captionStrong" color={color} style={{ fontSize: 11, lineHeight: 14 }} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function RecordRow({ record, vehicle, onPress, showVehicle = true }: { record: LogRecordFull; vehicle?: Vehicle; onPress: () => void; showVehicle?: boolean }) {
  const { colors } = useTheme();
  const visual = recordVisual(record, colors.primary);
  const tag = record.kind === 'accessory' && record.items[0] ? accessoryTag(record.items[0].item) : undefined;
  const thumb = record.photos[0] ? photoUri(record.photos[0].path) : null;
  const meta = [formatDay(record.date), record.odometer !== null ? formatKm(record.odometer) : null, showVehicle && vehicle ? `${vehicle.brand} ${vehicle.model}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
      })}>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: visual.color + '1F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {thumb ? <Image source={{ uri: thumb }} style={{ width: 46, height: 46 }} contentFit="cover" /> : <Icon name={visual.icon} size={24} color={visual.color} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {recordTitle(record)}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {tag ? <TagPill label={tag.label} color={visual.color} /> : null}
          <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {meta}
          </AppText>
        </View>
        {record.description ? (
          <AppText variant="caption" tone="subtle" numberOfLines={1}>
            {record.description.replace(/\n/g, ' ')}
          </AppText>
        ) : null}
      </View>
      {record.amountCents !== null ? (
        <AppText variant="subheading" style={{ fontVariant: ['tabular-nums'] }}>
          {formatAmount(record.amountCents)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function dueLabel(it: UpcomingItem): string {
  const d = it.due;
  if (d.status === 'overdue') {
    if (d.remainingKm !== null && d.remainingKm <= 0) return `Vencido hace ${formatInt(-d.remainingKm)} km`;
    if (d.dueDate) return `Vencido ${relativeDays(d.dueDate)}`;
    return 'Vencido';
  }
  const parts: string[] = [];
  if (d.effectiveDate) parts.push(`${formatDay(d.effectiveDate)} (${relativeDays(d.effectiveDate)})`);
  if (d.remainingKm !== null) parts.push(`faltan ${formatInt(d.remainingKm)} km`);
  return parts.join(' · ') || 'Sin fecha';
}

/** Icon and color of an agenda item: its plan item, else its category, else a reminder bell. */
export function upcomingVisual(item: UpcomingItem, primary: string): { icon: string; color: string } {
  if (item.source === 'manual') return { icon: 'bell-ring', color: primary };
  const plan = planItem(item.item);
  if (plan) return { icon: plan.icon, color: plan.color };
  const cat = item.categoryKey ? findCategory(item.categoryKey) : undefined;
  return { icon: cat?.icon ?? 'wrench', color: cat?.color ?? primary };
}

export function UpcomingRow({ item, vehicle, onPress, compact }: { item: UpcomingItem; vehicle?: Vehicle; onPress?: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  const visual = upcomingVisual(item, colors.primary);
  const tone = item.due.status === 'overdue' ? 'danger' : item.due.status === 'soon' ? 'warning' : 'success';
  const barColor = { danger: colors.danger, warning: colors.warning, success: colors.success }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        borderLeftWidth: 4,
        borderLeftColor: barColor,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: visual.color + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={visual.icon} size={21} color={visual.color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.title}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {vehicle ? `${vehicle.brand} ${vehicle.model} · ` : ''}
            {item.estimated ? 'Estimado · ' : ''}
            {dueLabel(item)}
          </AppText>
        </View>
        <Pill
          tone={tone}
          label={item.due.status === 'overdue' ? 'Vencido' : item.due.status === 'soon' ? 'Pronto' : 'Al día'}
        />
      </View>
      {!compact && item.source === 'service' ? (
        <View style={{ gap: 4 }}>
          <ProgressBar value={item.due.progress} color={barColor} />
          <AppText variant="caption" tone="subtle" style={{ fontSize: 12 }}>
            {item.lastDate ? `Último: ${formatDay(item.lastDate)}` : 'Todavía sin registrar'}
            {item.lastKm !== null && item.lastKm !== undefined ? ` · ${formatKm(item.lastKm)}` : ''}
            {item.due.trigger === 'km' ? ' · fecha estimada por tu uso' : ''}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
