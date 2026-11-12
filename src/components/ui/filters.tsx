import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Sheet } from './overlays';
import { AppText, Icon, ListRow } from './primitives';

/** Pill that shows the current value of a filter and opens its options ("Todos los autos ▾"). */
export function FilterButton({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const tint = active ? colors.primary : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filtro: ${label}`}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
      })}>
      <Icon name={icon} size={18} color={tint} />
      <AppText variant="captionStrong" color={active ? colors.primary : colors.text} numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </AppText>
      <Icon name="chevron-down" size={18} color={tint} />
    </Pressable>
  );
}

export interface FilterOption {
  /** null = "todos". */
  key: string | null;
  label: string;
  subtitle?: string;
  icon: string;
  color?: string;
  /** How many results this option would show (optional). */
  count?: number;
}

/** Single-choice list of filter options in a sheet. */
export function FilterSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: FilterOption[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ flexShrink: 1 }}>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface }}>
          {options.map((o, idx) => (
            <ListRow
              key={o.key ?? 'all'}
              icon={o.icon}
              iconColor={o.color}
              title={o.label}
              subtitle={o.subtitle}
              value={o.count !== undefined ? String(o.count) : undefined}
              last={idx === options.length - 1}
              right={<Icon name={o.key === selected ? 'check-circle' : 'circle-outline'} size={22} color={o.key === selected ? colors.primary : colors.border} />}
              onPress={() => onSelect(o.key)}
            />
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}
