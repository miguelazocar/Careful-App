import { memo } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { Icon } from './ui/primitives';

/** Icons of the jobs Careful keeps track of, repeated as a pattern. */
const ICONS = [
  'oil',
  'air-filter',
  'car-battery',
  'tire',
  'car-brake-abs',
  'steering',
  'fan',
  'gas-station',
  'car-wash',
  'lightning-bolt',
  'wrench',
  'coolant-temperature',
  'cogs',
  'speedometer',
  'car-shift-pattern',
  'car-light-high',
  'spray-bottle',
  'oil-level',
  'engine',
  'car-cog',
  'tools',
  'calendar-clock',
  'car-seat',
  'car-door',
];

const CELL = 58;

/**
 * Full-bleed decorative mosaic of service icons (staggered, slightly tilted, very transparent).
 * Purely visual: ignores touches and is hidden from screen readers.
 */
export const IconMosaic = memo(function IconMosaic({ color = '#FFFFFF', opacity = 0.09, size = 26 }: { color?: string; opacity?: number; size?: number }) {
  const { width, height } = useWindowDimensions();
  // oversized so the rotated pattern still covers every corner
  const cols = Math.ceil((width * 1.5) / CELL) + 1;
  const rows = Math.ceil((height * 1.5) / CELL) + 1;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity }}>
      <View style={{ position: 'absolute', left: -width * 0.25, top: -height * 0.25, transform: [{ rotate: '-14deg' }] }}>
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: 'row', marginLeft: r % 2 ? CELL / 2 : 0 }}>
            {Array.from({ length: cols }).map((__, c) => (
              <View key={c} style={{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ICONS[(r * 7 + c * 5) % ICONS.length]} size={size} color={color} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
});
