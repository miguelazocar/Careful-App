import { View } from 'react-native';

import { Stepper, TextField } from '@/components/ui/inputs';
import { spacing } from '@/theme/tokens';

export const monthsUnit = (n: number) => (n === 1 ? 'mes' : 'meses');

/**
 * "Cada [10.000] km  o cada [− 12 meses +]": when the next service is due, whichever comes first.
 * Km only accepts whole numbers; months use a stepper (0 = no time limit).
 */
export function IntervalFields({
  km,
  months,
  onKm,
  onMonths,
  kmLabel = 'Cada',
  monthsLabel = 'o cada',
}: {
  km: string;
  months: number;
  onKm: (v: string) => void;
  onMonths: (v: number) => void;
  kmLabel?: string;
  monthsLabel?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <TextField label={kmLabel} value={km} onChangeText={onKm} format="int" suffix="km" placeholder="10.000" />
      </View>
      <View style={{ flex: 1.1 }}>
        <Stepper label={monthsLabel} value={months} onChange={onMonths} min={0} max={60} unit={monthsUnit} zeroLabel="Sin plazo" />
      </View>
    </View>
  );
}
