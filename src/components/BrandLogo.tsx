import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BRAND_LOGOS } from '@/data/catalog/logos';
import { isLightColor } from '@/domain/colors';
import { fonts } from '@/theme/tokens';

function initials(name: string | null | undefined): string {
  const words = (name ?? '').split(/[\s-]+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

/**
 * Brand badge: the brand's glyph on its own color (Simple Icons, see data/catalog/logos.ts),
 * or a monogram for brands without an icon or typed by hand.
 */
export function BrandLogo({ brandId, brand, size = 40 }: { brandId?: string | null; brand?: string | null; size?: number }) {
  const logo = brandId ? BRAND_LOGOS[brandId] : undefined;
  // neutral slate for monograms, so they never look like an app control
  const bg = logo?.hex ?? '#3A4658';
  const fg = isLightColor(bg) ? '#1D2633' : '#FFFFFF';
  return (
    <View
      accessibilityLabel={brand ?? undefined}
      style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {logo ? (
        <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
          <Path d={logo.path} fill={fg} />
        </Svg>
      ) : (
        <Text style={{ color: fg, fontFamily: fonts.display, fontSize: size * 0.36 }}>{initials(brand)}</Text>
      )}
    </View>
  );
}
