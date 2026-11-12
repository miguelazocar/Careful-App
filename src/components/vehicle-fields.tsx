import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BRANDS, normalizeText } from '@/data/catalog';
import { isLightColor, VEHICLE_COLORS } from '@/domain/colors';
import { PLATE_GROUPS, PLATE_STYLES } from '@/domain/plate-styles';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { PlateBadge } from './brand';
import { BrandLogo } from './BrandLogo';
import { FieldLabel, TextField } from './ui/inputs';
import { Sheet } from './ui/overlays';
import { AppText, Grid, Icon } from './ui/primitives';

/** Looks like a text field; opens a picker sheet. */
export function SelectField({
  label,
  value,
  placeholder,
  left,
  onPress,
  disabled,
}: {
  label: string;
  value: string | null | undefined;
  placeholder: string;
  left?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, opacity: disabled ? 0.5 : 1 }}>
      <FieldLabel label={label} />
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          minHeight: 52,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        })}>
        {left}
        <AppText variant={value ? 'bodyStrong' : 'body'} tone={value ? 'default' : 'subtle'} numberOfLines={1} style={{ flex: 1 }}>
          {value || placeholder}
        </AppText>
        <Icon name="chevron-down" size={20} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

export interface Option {
  key: string;
  label: string;
  sub?: string;
  icon?: string;
}

/**
 * Searchable list in a bottom sheet. With `onCustom`, whatever the user types that is not in the
 * list can be used as-is ("Usar «…»").
 */
export function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  onCustom,
  placeholder = 'Buscar',
  extraOption,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  selected?: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  onCustom?: (text: string) => void;
  placeholder?: string;
  /** Always-visible last row, e.g. "Otro modelo". */
  extraOption?: { label: string; sub?: string; icon?: string; onPress: () => void };
}) {
  const [query, setQuery] = useState('');
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setQuery('');
  }
  const q = normalizeText(query);
  const shown = q ? options.filter((o) => normalizeText(o.label).includes(q)) : options;
  const exact = options.some((o) => normalizeText(o.label) === q);
  const showSearch = !!onCustom || options.length > 8;

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {showSearch ? (
        <View style={{ marginBottom: spacing.sm }}>
          <TextField value={query} onChangeText={setQuery} placeholder={placeholder} icon="magnify" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => onCustom && query.trim() && !exact && onCustom(query.trim())} />
        </View>
      ) : null}
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: spacing.xs }}>
        {onCustom && query.trim() && !exact ? (
          <OptionRow icon="pencil" label={`Usar «${query.trim()}»`} selected={false} onPress={() => onCustom(query.trim())} />
        ) : null}
        {shown.map((o) => (
          <OptionRow key={o.key} icon={o.icon} label={o.label} sub={o.sub} selected={selected === o.key} onPress={() => onSelect(o.key)} />
        ))}
        {!shown.length && !onCustom ? (
          <AppText variant="caption" tone="muted" align="center" style={{ padding: spacing.md }}>
            Sin resultados
          </AppText>
        ) : null}
        {extraOption ? <OptionRow icon={extraOption.icon ?? 'pencil'} label={extraOption.label} sub={extraOption.sub} selected={false} onPress={extraOption.onPress} /> : null}
      </ScrollView>
    </Sheet>
  );
}

function OptionRow({ icon, label, sub, selected, onPress }: { icon?: string; label: string; sub?: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderRadius: radius.md,
        backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      })}>
      {icon ? <Icon name={icon} size={20} color={colors.primary} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {sub ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {selected ? <Icon name="check-circle" size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

/** Best-selling brands in Argentina, shown first. */
const POPULAR_BRANDS = ['volkswagen', 'fiat', 'chevrolet', 'toyota', 'ford', 'renault', 'peugeot', 'citroen', 'jeep', 'nissan', 'honda', 'hyundai'];

/** Searchable brand grid with logos: best sellers first, then every brand; a brand not listed can be typed. */
export function BrandSheet({
  visible,
  selected,
  onSelect,
  onCustom,
  onClose,
}: {
  visible: boolean;
  selected: string | null;
  onSelect: (brandId: string) => void;
  onCustom: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setQuery('');
  }
  const q = normalizeText(query);
  const matches = q ? BRANDS.filter((b) => normalizeText(b.name).includes(q)) : BRANDS;
  const popular = q ? [] : POPULAR_BRANDS.map((id) => BRANDS.find((b) => b.id === id)).filter((b): b is (typeof BRANDS)[number] => !!b);
  const exact = BRANDS.some((b) => normalizeText(b.name) === q);

  const tiles = (list: typeof BRANDS) => (
    <Grid columns={3} gap={spacing.xs}>
      {list.map((b) => (
        <BrandTile key={b.id} id={b.id} name={b.name} active={selected === b.id} onPress={() => onSelect(b.id)} />
      ))}
    </Grid>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Marca">
      <View style={{ marginBottom: spacing.sm }}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={`Buscar entre ${BRANDS.length} marcas`}
          icon="magnify"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (matches.length === 1) onSelect(matches[0].id);
            else if (query.trim() && !matches.length) onCustom(query.trim());
          }}
        />
      </View>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xs }}>
        {popular.length ? (
          <>
            <AppText variant="overline" tone="muted">
              Más elegidas
            </AppText>
            {tiles(popular)}
            <AppText variant="overline" tone="muted" style={{ marginTop: spacing.xs }}>
              Todas las marcas
            </AppText>
          </>
        ) : null}
        {tiles(matches)}
        {query.trim() && !exact ? <OptionRow icon="pencil" label={`Usar «${query.trim()}»`} sub="La marca no está en la lista" selected={false} onPress={() => onCustom(query.trim())} /> : null}
      </ScrollView>
    </Sheet>
  );
}

function BrandTile({ id, name, active, onPress }: { id: string; name: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={name}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
        paddingHorizontal: 4,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
      })}>
      <BrandLogo brandId={id} brand={name} size={40} />
      <AppText variant="captionStrong" numberOfLines={1} adjustsFontSizeToFit>
        {name}
      </AppText>
    </Pressable>
  );
}

/** Color swatches, plus a custom name. */
export function ColorSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string | null;
  onSelect: (name: string, hex: string | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [custom, setCustom] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title="Color">
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
        <Grid columns={4}>
          {VEHICLE_COLORS.map((c) => {
            const active = selected === c.name;
            return (
              <Pressable key={c.name} onPress={() => onSelect(c.name, c.hex)} style={{ alignItems: 'center', gap: 6 }} accessibilityLabel={c.name}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: c.hex,
                    borderWidth: active ? 3 : 1,
                    borderColor: active ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {active ? <Icon name="check" size={22} color={isLightColor(c.hex) ? '#111' : '#fff'} /> : null}
                </View>
                <AppText variant="caption" tone="muted" style={{ fontSize: 12 }} numberOfLines={1}>
                  {c.name}
                </AppText>
              </Pressable>
            );
          })}
        </Grid>
        <TextField
          value={custom}
          onChangeText={setCustom}
          placeholder="Otro color"
          icon="pencil"
          returnKeyType="done"
          onSubmitEditing={() => custom.trim() && onSelect(custom.trim(), null)}
          right={
            custom.trim() ? (
              <Pressable onPress={() => onSelect(custom.trim(), null)} hitSlop={8}>
                <AppText variant="captionStrong" tone="primary">
                  Usar
                </AppText>
              </Pressable>
            ) : undefined
          }
        />
      </ScrollView>
    </Sheet>
  );
}

/** "Tipo de patente": every design grouped (Mercosur, Sudamérica, Unión Europea…), each previewed with the user's plate. */
export function PlateStyleSheet({ visible, plate, selected, onSelect, onClose }: { visible: boolean; plate: string; selected: string; onSelect: (key: string) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setQuery('');
  }
  const q = normalizeText(query);
  const shown = PLATE_STYLES.filter((s) => !q || normalizeText(`${s.label} ${s.group}`).includes(q));
  return (
    <Sheet visible={visible} onClose={onClose} title="Tipo de patente">
      <View style={{ marginBottom: spacing.sm }}>
        <TextField value={query} onChangeText={setQuery} placeholder="Buscar país" icon="magnify" autoCorrect={false} />
      </View>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: spacing.xs }}>
        {PLATE_GROUPS.map((group) => {
          const styles = shown.filter((s) => s.group === group);
          if (!styles.length) return null;
          return (
            <View key={group} style={{ gap: 6 }}>
              <AppText variant="captionStrong" tone="muted" style={{ marginTop: spacing.xs }}>
                {group}
              </AppText>
              {styles.map((s) => {
                const active = s.key === selected;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => onSelect(s.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={s.label}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      borderRadius: radius.md,
                      backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                    })}>
                    <View style={{ width: 132 }}>
                      <PlateBadge plate={plate || null} plateStyle={s.key} size="sm" placeholder />
                    </View>
                    <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                      {s.label}
                    </AppText>
                    {active ? <Icon name="check-circle" size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}
