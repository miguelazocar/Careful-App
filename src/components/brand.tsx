import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { flagEmoji } from '@/domain/countries';
import { formatPlate } from '@/domain/plate';
import { plateText, resolvePlateStyle } from '@/domain/plate-styles';
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

/**
 * License plate drawn with its real design ("tipo de patente"): the Mercosur blue band (MERCOSUR
 * and the country flag), the black Argentine plate of 1995–2016, Chile, Perú, the EU blue strip
 * (stars and the country flag), or a plain one.
 */
export function PlateBadge({
  plate,
  plateStyle,
  country = 'AR',
  size = 'md',
  align = 'start',
  placeholder,
}: {
  plate: string | null;
  /** A PlateStyle key; null/undefined = deduced from `country` and the plate format. */
  plateStyle?: string | null;
  country?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Horizontal placement inside its parent. */
  align?: 'start' | 'end' | 'center';
  /** Shown (dimmed) when there is no plate yet, e.g. in the picker previews. */
  placeholder?: boolean;
}) {
  const style = resolvePlateStyle({ plateStyle, country, plate });
  if (!plate && !placeholder) return null;
  const text = plate ? plateText(style, formatPlate(plate, style.country)) : style.placeholder;
  const scale = size === 'lg' ? 1.35 : size === 'sm' ? 0.78 : 1;
  const fontSize = 15 * scale;
  const ink = style.design === 'ar-1995' ? '#FFFFFF' : '#111111';
  const chars = (
    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.display, fontSize, color: ink, letterSpacing: 1.2 * scale, flexShrink: 1, opacity: plate ? 1 : 0.55 }}>
      {text}
    </Text>
  );
  const frame = {
    flexDirection: 'row' as const,
    alignSelf: align === 'end' ? ('flex-end' as const) : align === 'center' ? ('center' as const) : ('flex-start' as const),
    maxWidth: '100%' as const,
    borderRadius: 5 * scale,
    overflow: 'hidden' as const,
    borderWidth: 1.5,
  };
  const small = { fontFamily: fonts.bodySemibold, letterSpacing: 0.6, textAlign: 'center' as const };

  if (style.design === 'eu') {
    return (
      <View accessibilityLabel={`Patente ${text}, ${style.label}`} style={{ ...frame, borderColor: '#1D1D1D', backgroundColor: '#FFFFFF' }}>
        <View style={{ width: 17 * scale, backgroundColor: '#003399', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 * scale }}>
          <EuStars size={11 * scale} />
          <Text style={{ fontSize: 7.5 * scale, lineHeight: 10 * scale }}>{flagEmoji(style.country)}</Text>
        </View>
        <View style={{ justifyContent: 'center', paddingHorizontal: 8 * scale, paddingVertical: 3 * scale, flexShrink: 1 }}>{chars}</View>
      </View>
    );
  }

  const band =
    style.design === 'mercosur' ? (
      <View style={{ backgroundColor: '#1F3C8C', paddingHorizontal: 6 * scale, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <Text style={{ ...small, color: '#FFFFFF', fontSize: 6.5 * scale, letterSpacing: 1 }} numberOfLines={1}>
          {style.band}
        </Text>
        <Text style={{ fontSize: 7 * scale, lineHeight: 9 * scale }}>{flagEmoji(style.country)}</Text>
      </View>
    ) : style.design === 'pe' ? (
      <View style={{ backgroundColor: '#D91023', paddingVertical: 1 }}>
        <Text style={{ ...small, color: '#FFFFFF', fontSize: 6.5 * scale }}>{style.band}</Text>
      </View>
    ) : style.design === 'cl' || style.design === 'ar-1995' ? (
      <Text style={{ ...small, color: ink, fontSize: 5.5 * scale, paddingTop: 2 * scale }}>{style.band}</Text>
    ) : null;

  return (
    <View
      accessibilityLabel={`Patente ${text}, ${style.label}`}
      style={{
        ...frame,
        borderColor: style.design === 'ar-1995' ? '#000000' : style.design === 'mercosur' ? '#1B2A4A' : '#1D1D1D',
        backgroundColor: style.design === 'ar-1995' ? '#121212' : '#FFFFFF',
      }}>
      <View style={style.design === 'ar-1995' ? { margin: 1.5 * scale, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 3 * scale } : undefined}>
        {band}
        <View style={{ alignItems: 'center', paddingHorizontal: 8 * scale, paddingVertical: band ? 1 : 3 * scale }}>{chars}</View>
      </View>
    </View>
  );
}

/** The ring of 12 yellow stars of the EU strip (dots at this size). */
function EuStars({ size }: { size: number }) {
  const dot = Math.max(1.2, size * 0.14);
  const r = (size - dot) / 2;
  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <View key={i} style={{ position: 'absolute', width: dot, height: dot, borderRadius: dot / 2, backgroundColor: '#FFCC00', left: r + r * Math.cos(a), top: r + r * Math.sin(a) }} />;
      })}
    </View>
  );
}
