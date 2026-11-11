import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { formatDay, parseDay, toDay } from '@/lib/dates';
import { formatAmountInput, formatIntInput } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, spacing } from '@/theme/tokens';

import { AppText, Icon, type IconName } from './primitives';

export function FieldLabel({ label, hint, right }: { label: string; hint?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6, gap: spacing.xs }}>
      <View style={{ flex: 1 }}>
        <AppText variant="captionStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="subtle">
            {hint}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export interface TextFieldProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  label?: string;
  hint?: string;
  error?: string | null;
  value: string;
  onChangeText: (v: string) => void;
  icon?: IconName | string;
  suffix?: string;
  format?: 'int' | 'amount' | 'upper';
  right?: ReactNode;
  labelRight?: ReactNode;
}

export function TextField({ label, hint, error, value, onChangeText, icon, suffix, format, right, labelRight, multiline, style, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const keyboardType: KeyboardTypeOptions | undefined =
    format === 'int' ? 'number-pad' : format === 'amount' ? 'decimal-pad' : rest.keyboardType;
  const handle = (t: string) => {
    if (format === 'int') onChangeText(formatIntInput(t));
    else if (format === 'amount') onChangeText(formatAmountInput(t.replace('.', ',')));
    else if (format === 'upper') onChangeText(t.toUpperCase());
    else onChangeText(t);
  };
  return (
    <View>
      {label ? <FieldLabel label={label} hint={hint} right={labelRight} /> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: spacing.xs,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
          paddingHorizontal: spacing.md,
          minHeight: multiline ? 110 : 52,
          paddingVertical: multiline ? spacing.sm : 0,
        }}>
        {icon ? <Icon name={icon} size={20} color={focused ? colors.primary : colors.textSubtle} style={multiline ? { marginTop: 2 } : undefined} /> : null}
        <TextInput
          {...rest}
          multiline={multiline}
          value={value}
          onChangeText={handle}
          keyboardType={keyboardType}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          style={[
            {
              flex: 1,
              color: colors.text,
              fontFamily: fonts.bodyMedium,
              fontSize: 16,
              paddingVertical: multiline ? 0 : 12,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
        />
        {suffix ? (
          <AppText variant="captionStrong" tone="muted">
            {suffix}
          </AppText>
        ) : null}
        {right}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** "−  12 meses  +": small integers without the keyboard. `zeroLabel` names 0 when allowed (min 0). */
export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 60,
  unit,
  zeroLabel,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: (n: number) => string;
  zeroLabel?: string;
}) {
  const { colors } = useTheme();
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  const button = (icon: string, delta: number, disabled: boolean) => (
    <Pressable
      onPress={() => step(delta)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? 'Restar' : 'Sumar'}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt,
        opacity: disabled ? 0.35 : 1,
      })}>
      <Icon name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
  return (
    <View>
      {label ? <FieldLabel label={label} /> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 52,
          paddingHorizontal: 4,
          gap: 4,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}>
        {button('minus', -1, value <= min)}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 }} accessibilityLiveRegion="polite">
          {value === 0 && zeroLabel ? (
            <AppText variant="captionStrong" tone="muted">
              {zeroLabel}
            </AppText>
          ) : (
            <>
              <AppText variant="number" style={{ fontSize: 22 }}>
                {value}
              </AppText>
              {unit ? (
                <AppText variant="captionStrong" tone="muted">
                  {unit(value)}
                </AppText>
              ) : null}
            </>
          )}
        </View>
        {button('plus', 1, value >= max)}
      </View>
    </View>
  );
}

export function DateField({ label, value, onChange, maximumToday = true }: { label?: string; value: string; onChange: (day: string) => void; maximumToday?: boolean }) {
  const { colors } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseDay(value),
        mode: 'date',
        maximumDate: maximumToday ? new Date() : undefined,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toDay(date));
        },
      });
    } else {
      setIosOpen((v) => !v);
    }
  };
  return (
    <View>
      {label ? <FieldLabel label={label} /> : null}
      <Pressable
        onPress={open}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          height: 52,
        }}>
        <Icon name="calendar-month" size={20} color={colors.primary} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {formatDay(value, "EEEE d 'de' MMMM yyyy")}
        </AppText>
        <Icon name="chevron-down" size={20} color={colors.textSubtle} />
      </Pressable>
      {Platform.OS === 'ios' && iosOpen ? (
        <DateTimePicker
          value={parseDay(value)}
          mode="date"
          display="inline"
          maximumDate={maximumToday ? new Date() : undefined}
          onChange={(_, d) => d && onChange(toDay(d))}
        />
      ) : null}
    </View>
  );
}
