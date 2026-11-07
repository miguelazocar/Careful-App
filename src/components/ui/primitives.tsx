import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { brand, fonts, radius, spacing } from '@/theme/tokens';

/* ---------------------------------- Icon ---------------------------------- */

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color, style }: { name: IconName | string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color ?? colors.text} style={style} />;
}

/* ---------------------------------- Text ---------------------------------- */

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'captionStrong' | 'overline' | 'number';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.title, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.title, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  number: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  tone?: 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'success' | 'warning' | 'inverse';
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', color, tone = 'default', align, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const toneColor = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    primary: colors.primary,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    inverse: '#FFFFFF',
  }[tone];
  return <Text {...rest} style={[VARIANTS[variant], { color: color ?? toneColor, textAlign: align }, style]} />;
}

/* --------------------------------- Button --------------------------------- */

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  icon?: IconName | string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'mint';
  size?: 'md' | 'lg' | 'sm';
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}

export function Button({ label, icon, variant = 'primary', size = 'md', loading, full, style, disabled, onPress, haptic = true, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const height = size === 'lg' ? 56 : size === 'sm' ? 38 : 48;
  const fg =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'mint'
        ? '#06231C'
        : variant === 'secondary'
          ? colors.primary
          : colors.text;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: size === 'sm' ? 14 : 20, height }}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} color={fg} /> : null}
          <AppText variant={size === 'sm' ? 'captionStrong' : 'bodyStrong'} color={fg} numberOfLines={1}>
            {label}
          </AppText>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={(e) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          borderRadius: radius.lg,
          overflow: 'hidden',
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          alignSelf: full ? 'stretch' : 'auto',
        },
        variant === 'secondary' && { backgroundColor: colors.primarySoft },
        variant === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
        variant === 'danger' && { backgroundColor: colors.danger },
        style,
      ]}>
      {variant === 'primary' || variant === 'mint' ? (
        <LinearGradient
          colors={variant === 'mint' ? [...brand.gradientMint] : [...brand.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 44,
  tone = 'surface',
  color,
  accessibilityLabel,
  style,
}: {
  icon: IconName | string;
  onPress?: () => void;
  size?: number;
  tone?: 'surface' | 'primary' | 'clear' | 'glass';
  color?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = { surface: colors.surface, primary: colors.primary, clear: 'transparent', glass: 'rgba(10,15,28,0.45)' }[tone];
  const fg = color ?? (tone === 'primary' || tone === 'glass' ? '#FFFFFF' : colors.text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
          borderWidth: tone === 'surface' ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}>
      <Icon name={icon} size={size * 0.5} color={fg} />
    </Pressable>
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const { colors, isDark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: padded ? spacing.md : 0,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: isDark ? 0 : 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: isDark ? 0 : 2,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

/* ---------------------------------- Chip ---------------------------------- */

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  onRemove,
  size = 'md',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName | string;
  color?: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: size === 'sm' ? 10 : 14,
        height: size === 'sm' ? 32 : 40,
        borderRadius: radius.pill,
        backgroundColor: selected ? accent : colors.surface,
        borderWidth: 1,
        borderColor: selected ? accent : colors.border,
        opacity: pressed ? 0.8 : 1,
      })}>
      {icon ? <Icon name={icon} size={16} color={selected ? '#fff' : accent} /> : null}
      <AppText variant={size === 'sm' ? 'captionStrong' : 'captionStrong'} color={selected ? '#FFFFFF' : colors.text} numberOfLines={1}>
        {label}
      </AppText>
      {onRemove ? (
        <Pressable hitSlop={8} onPress={onRemove} accessibilityLabel={`Quitar ${label}`}>
          <Icon name="close" size={16} color={selected ? '#fff' : colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/* --------------------------------- Section -------------------------------- */

export function SectionTitle({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }, style]}>
      <AppText variant="heading">{title}</AppText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <AppText variant="captionStrong" tone="primary">
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/* --------------------------------- ListRow -------------------------------- */

export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onPress,
  right,
  danger,
  last,
}: {
  icon?: IconName | string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : (iconColor ?? colors.primary);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      })}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={tint} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color={danger ? colors.danger : undefined}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" tone="muted">
          {value}
        </AppText>
      ) : null}
      {right ?? (onPress ? <Icon name="chevron-right" size={22} color={colors.textSubtle} /> : null)}
    </Pressable>
  );
}

export function SwitchRow({ icon, title, subtitle, value, onChange, last, disabled }: { icon?: IconName | string; title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      last={last}
      right={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={(v) => {
            void Haptics.selectionAsync();
            onChange(v);
          }}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      }
    />
  );
}

/* -------------------------------- Segmented ------------------------------- */

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: IconName | string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              justifyContent: 'center',
              height: 38,
              borderRadius: radius.sm,
              backgroundColor: active ? colors.surface : 'transparent',
              shadowColor: colors.shadow,
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: 6,
              elevation: active ? 1 : 0,
            }}>
            {o.icon ? <Icon name={o.icon} size={16} color={active ? colors.primary : colors.textMuted} /> : null}
            <AppText variant="captionStrong" color={active ? colors.text : colors.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------ Progress bar ------------------------------ */

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color ?? colors.primary }} />
    </View>
  );
}

/* ------------------------------- Empty state ------------------------------ */

export function EmptyState({ icon, title, message, action }: { icon: IconName | string; title: string; message?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Icon name={icon} size={36} color={colors.primary} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" tone="muted" align="center">
          {message}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/* ------------------------------- Status pill ------------------------------ */

export function Pill({ label, tone, icon }: { label: string; tone: 'danger' | 'warning' | 'success' | 'primary' | 'neutral'; icon?: IconName | string }) {
  const { colors } = useTheme();
  const map = {
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    success: [colors.successSoft, colors.success],
    primary: [colors.primarySoft, colors.primary],
    neutral: [colors.surfaceAlt, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, paddingHorizontal: 8, height: 24, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <AppText variant="captionStrong" color={fg} style={{ fontSize: 12 }}>
        {label}
      </AppText>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

/* ---------------------------------- Grid ---------------------------------- */

/** Fixed-column grid that never wraps unexpectedly (percent widths + gaps overflow on some screens). */
export function Grid({ columns, gap = spacing.sm, children }: { columns: number; gap?: number; children: ReactNode }) {
  const items = (Array.isArray(children) ? children.flat() : [children]).filter((c) => c !== null && c !== undefined && c !== false);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((child, c) => (
            <View key={c} style={{ flex: 1 }}>
              {child}
            </View>
          ))}
          {Array.from({ length: columns - row.length }).map((_, k) => (
            <View key={`pad${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
