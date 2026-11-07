import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { formatMonth, formatMonthShort } from '@/lib/dates';
import { formatAmount, formatAmountCompact } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './ui/primitives';

export interface MonthValue {
  month: string; // YYYY-MM
  cents: number;
  count: number;
}

/** Bar path with 4px rounded data-end, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/**
 * Single-series monthly spend. One hue (brand primary), thin rounded bars on a recessive baseline,
 * value shown only for the selected month (tap a bar — the mobile equivalent of hover).
 */
export function MonthlyChart({ data, height = 150 }: { data: MonthValue[]; height?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(data.length - 1);
  const sel = data[Math.min(selected, data.length - 1)];
  const max = Math.max(...data.map((d) => d.cents), 1);
  const plotH = height - 24;
  const slot = width / Math.max(data.length, 1);
  const barW = Math.min(28, slot * 0.5);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <AppText variant="caption" tone="muted" style={{ textTransform: 'capitalize' }}>
          {sel ? formatMonth(sel.month) : ''}
        </AppText>
        <AppText variant="captionStrong">
          {sel ? `${formatAmount(sel.cents)} · ${sel.count} ${sel.count === 1 ? 'registro' : 'registros'}` : ''}
        </AppText>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={plotH}>
            {data.map((d, i) => {
              const h = d.cents > 0 ? Math.max(4, (d.cents / max) * (plotH - 18)) : 0;
              const x = i * slot + (slot - barW) / 2;
              return (
                <Path
                  key={d.month}
                  d={barPath(x, plotH - h, barW, h)}
                  fill={colors.primary}
                  opacity={i === selected ? 1 : 0.38}
                />
              );
            })}
            <Line x1={0} x2={width} y1={plotH - 0.5} y2={plotH - 0.5} stroke={colors.border} strokeWidth={1} />
          </Svg>
        ) : null}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
          {data.map((d, i) => (
            <Pressable
              key={d.month}
              accessibilityLabel={`${formatMonth(d.month)}: ${formatAmount(d.cents)}`}
              onPress={() => {
                void Haptics.selectionAsync();
                setSelected(i);
              }}
              style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
              {i === selected && d.cents > 0 ? (
                <AppText
                  variant="captionStrong"
                  style={{ position: 'absolute', top: Math.max(0, plotH - Math.max(4, (d.cents / max) * (plotH - 18)) - 18), fontSize: 11 }}>
                  {formatAmountCompact(d.cents)}
                </AppText>
              ) : null}
              <AppText variant="caption" tone={i === selected ? 'default' : 'subtle'} style={{ fontSize: 11, textTransform: 'capitalize' }}>
                {formatMonthShort(d.month)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
