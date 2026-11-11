import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { findCountry, flagEmoji } from '@/domain/countries';
import { formatPlate } from '@/domain/plate';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const WORDMARK_RATIO = 650 / 162;

export function Wordmark({ height = 30, variant = 'auto' }: { height?: number; variant?: 'auto' | 'light' | 'dark' }) {
  const { isDark } = useTheme();
  const dark = variant === 'auto' ? isDark : variant === 'dark';
  return (
    <Image
      source={dark ? require('@/assets/images/wordmark-dark.png') : require('@/assets/images/wordmark-light.png')}
      style={{ height, width: height * WORDMARK_RATIO }}
      contentFit="contain"
      accessibilityLabel="Careful"
    />
  );
}

export function AppIcon({ size = 72 }: { size?: number }) {
  return <Image source={require('@/assets/images/icon-rounded.png')} style={{ width: size, height: size }} contentFit="contain" />;
}

const COUNTRY_TITLES: Record<string, string> = {
  AR: 'ARGENTINA',
  UY: 'URUGUAY',
  BR: 'BRASIL',
  PY: 'PARAGUAY',
  BO: 'BOLIVIA',
  VE: 'VENEZUELA',
};

/** License plate rendered like the real thing — Mercosur style when it applies. */
export function PlateBadge({
  plate,
  country = 'AR',
  size = 'md',
  align = 'start',
}: {
  plate: string | null;
  country?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Horizontal placement inside its parent. */
  align?: 'start' | 'end';
}) {
  const { colors } = useTheme();
  if (!plate) return null;
  const formatted = formatPlate(plate, country);
  const mercosur = !!findCountry(country)?.mercosur && /^[A-Z]{2}\s?\d{3}\s?[A-Z]{2}$|^[A-Z]{3}\d[A-Z]\d{2}$/.test(formatted);
  const scale = size === 'lg' ? 1.35 : size === 'sm' ? 0.8 : 1;
  const fontSize = 15 * scale;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: align === 'end' ? 'flex-end' : 'flex-start',
        maxWidth: '100%',
        alignItems: 'center',
        borderRadius: 6 * scale,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: mercosur ? '#1B2A4A' : colors.border,
        backgroundColor: '#FFFFFF',
      }}>
      <View>
        {mercosur ? (
          <View style={{ backgroundColor: '#1F3C8C', paddingHorizontal: 6 * scale, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#fff', fontSize: 6.5 * scale, fontFamily: fonts.bodySemibold, letterSpacing: 0.6, flex: 1 }} numberOfLines={1}>
              {COUNTRY_TITLES[country] ?? country}
            </Text>
            <Text style={{ fontSize: 7 * scale }}>{flagEmoji(country)}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 * scale, paddingVertical: mercosur ? 1 : 3 * scale }}>
          {!mercosur ? <Text style={{ fontSize: fontSize * 0.85 }}>{flagEmoji(country)}</Text> : null}
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.display, fontSize, color: '#111', letterSpacing: 1.2, flexShrink: 1 }}>
            {formatted}
          </Text>
        </View>
      </View>
    </View>
  );
}
