import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { IntervalFields, monthsUnit } from '@/components/IntervalFields';
import { Sheet } from '@/components/ui/overlays';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Icon } from '@/components/ui/primitives';
import { getServiceRules, resetServiceRule, saveServiceRule } from '@/db/reminders';
import { getVehicle } from '@/db/vehicles';
import { trackableItems, type CatalogItem } from '@/domain/maintenance';
import { resolveInterval, type Interval } from '@/domain/schedule';
import { useQuery } from '@/hooks/useQuery';
import { formatInt, parseIntInput } from '@/lib/format';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

function describe(i: Interval): string {
  if (!i.enabled) return 'Sin aviso';
  const parts = [i.intervalKm ? `cada ${formatInt(i.intervalKm)} km` : null, i.intervalMonths ? `cada ${i.intervalMonths} ${monthsUnit(i.intervalMonths)}` : null].filter(Boolean);
  return parts.length ? parts.join(' o ') : 'Sin aviso';
}

/** Per-vehicle maintenance plan: the jobs Careful schedules, with editable intervals. */
export default function MaintenancePlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data } = useQuery(async () => ({ vehicle: await getVehicle(id), rules: await getServiceRules(id) }), [id]);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const rows = trackableItems().map((t) => ({ ...t, interval: resolveInterval(t.item.key, data?.rules ?? []) }));

  return (
    <Screen header={<Header back title="Plan de mantenimiento" />}>
      <AppText variant="body" tone="muted">
        Careful agenda estos services por kilómetros o por tiempo, lo que ocurra primero, y te avisa cuando se acercan. Ajustá los intervalos según el manual de tu {data?.vehicle?.model ?? 'auto'}.
      </AppText>
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="engine" size={20} color={colors.primary} />
          <AppText variant="subheading">Motor</AppText>
        </View>
        <Card padded={false}>
          {rows.map(({ item, plan, interval }, idx) => (
            <Pressable
              key={item.key}
              onPress={() => setEditing(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${describe(interval)}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: 12,
                gap: spacing.sm,
                backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
              })}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: plan.color + '1F', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={plan.icon} size={20} color={plan.color} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{item.label}</AppText>
                <AppText variant="caption" tone={interval.enabled && (interval.intervalKm || interval.intervalMonths) ? 'muted' : 'subtle'}>
                  {describe(interval)}
                  {interval.custom ? ' · personalizado' : ''}
                </AppText>
              </View>
              <Icon name="pencil" size={18} color={colors.textSubtle} />
            </Pressable>
          ))}
        </Card>
      </View>
      <RuleEditor vehicleId={id} target={editing} rules={data?.rules ?? []} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function RuleEditor({ vehicleId, target, rules, onClose }: { vehicleId: string; target: CatalogItem | null; rules: Parameters<typeof resolveInterval>[1]; onClose: () => void }) {
  const { colors } = useTheme();
  const current = target ? resolveInterval(target.key, rules) : null;
  const [km, setKm] = useState('');
  const [months, setMonths] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [key, setKey] = useState<string | null>(null);

  if (target && key !== target.key && current) {
    setKey(target.key);
    setKm(current.intervalKm ? formatInt(current.intervalKm) : '');
    setMonths(current.intervalMonths ?? 0);
    setEnabled(current.enabled);
  }
  if (!target && key !== null) setKey(null);

  const save = async () => {
    if (!target) return;
    const intervalKm = parseIntInput(km);
    const intervalMonths = months || null;
    if (enabled && !intervalKm && !intervalMonths) return toast('Ingresá kilómetros, meses o ambos', 'info');
    await saveServiceRule({ vehicleId, item: target.key, intervalKm, intervalMonths, enabled });
    toast('Intervalo actualizado');
    onClose();
  };

  return (
    <Sheet visible={!!target} onClose={onClose} title={target?.label}>
      {target ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="bodyStrong">Avisarme</AppText>
            <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
          </View>
          {enabled ? <IntervalFields km={km} months={months} onKm={setKm} onMonths={setMonths} /> : null}
          <AppText variant="caption" tone="subtle">
            Valores sugeridos: {target.intervalKm ? `${formatInt(target.intervalKm)} km` : '—'} / {target.intervalMonths ? `${target.intervalMonths} ${monthsUnit(target.intervalMonths)}` : '—'}. Respetá siempre el manual del fabricante.
          </AppText>
          <Button label="Guardar" icon="check" onPress={() => void save()} />
          {current?.custom ? (
            <Button
              label="Volver a los valores sugeridos"
              variant="ghost"
              onPress={async () => {
                await resetServiceRule(vehicleId, target.key);
                onClose();
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}
