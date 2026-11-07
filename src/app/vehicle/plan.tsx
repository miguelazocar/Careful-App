import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Sheet } from '@/components/ui/overlays';
import { TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Icon } from '@/components/ui/primitives';
import { getServiceRules, resetServiceRule, saveServiceRule } from '@/db/reminders';
import { getVehicle } from '@/db/vehicles';
import { ACCESSORY_CATEGORY, MAINTENANCE_CATEGORIES, type CatalogItem, type Category } from '@/domain/maintenance';
import { resolveInterval, type Interval } from '@/domain/schedule';
import { useQuery } from '@/hooks/useQuery';
import { formatInt, parseIntInput } from '@/lib/format';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

function describe(i: Interval): string {
  if (!i.enabled) return 'Sin aviso';
  const parts = [i.intervalKm ? `cada ${formatInt(i.intervalKm)} km` : null, i.intervalMonths ? `cada ${i.intervalMonths} ${i.intervalMonths === 1 ? 'mes' : 'meses'}` : null].filter(Boolean);
  return parts.length ? parts.join(' o ') : 'Sin aviso';
}

/** Per-vehicle maintenance plan: every item that can schedule a next service, with editable intervals. */
export default function MaintenancePlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data } = useQuery(async () => ({ vehicle: await getVehicle(id), rules: await getServiceRules(id) }), [id]);
  const [editing, setEditing] = useState<{ category: Category; item: CatalogItem } | null>(null);

  const categories = [...MAINTENANCE_CATEGORIES, ACCESSORY_CATEGORY]
    .map((c) => ({ ...c, items: c.items.filter((i) => !i.key.endsWith('.otro')) }))
    .filter((c) => c.items.length);

  return (
    <Screen header={<Header back title="Plan de mantenimiento" />}>
      <AppText variant="body" tone="muted">
        Careful agenda el próximo service por kilómetros o por tiempo, lo que ocurra primero. Ajustá los intervalos según el manual de tu {data?.vehicle?.model ?? 'auto'}.
      </AppText>
      {categories.map((c) => {
        const rows = c.items.map((item) => ({ item, interval: resolveInterval(item.key, data?.rules ?? []) }));
        const visible = rows.filter((r) => r.interval.intervalKm || r.interval.intervalMonths || r.interval.custom);
        const hidden = rows.filter((r) => !visible.includes(r));
        return (
          <View key={c.key} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={c.icon} size={20} color={c.color} />
              <AppText variant="subheading">{c.label}</AppText>
            </View>
            <Card padded={false}>
              {[...visible, ...hidden].map(({ item, interval }, idx, arr) => (
                <Pressable
                  key={item.key}
                  onPress={() => setEditing({ category: c, item })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing.md,
                    paddingVertical: 12,
                    gap: spacing.sm,
                    backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                    borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  })}>
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
        );
      })}
      <RuleEditor vehicleId={id} target={editing} rules={data?.rules ?? []} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function RuleEditor({ vehicleId, target, rules, onClose }: { vehicleId: string; target: { category: Category; item: CatalogItem } | null; rules: Parameters<typeof resolveInterval>[1]; onClose: () => void }) {
  const { colors } = useTheme();
  const current = target ? resolveInterval(target.item.key, rules) : null;
  const [km, setKm] = useState('');
  const [months, setMonths] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [key, setKey] = useState<string | null>(null);

  if (target && key !== target.item.key && current) {
    setKey(target.item.key);
    setKm(current.intervalKm ? formatInt(current.intervalKm) : '');
    setMonths(current.intervalMonths ? String(current.intervalMonths) : '');
    setEnabled(current.enabled);
  }
  if (!target && key !== null) setKey(null);

  const save = async () => {
    if (!target) return;
    const intervalKm = parseIntInput(km);
    const intervalMonths = parseIntInput(months);
    if (enabled && !intervalKm && !intervalMonths) return toast('Ingresá kilómetros, meses o ambos', 'info');
    await saveServiceRule({ vehicleId, item: target.item.key, intervalKm, intervalMonths, enabled });
    toast('Intervalo actualizado');
    onClose();
  };

  return (
    <Sheet visible={!!target} onClose={onClose} title={target?.item.label}>
      {target ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="bodyStrong">Avisarme</AppText>
            <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
          </View>
          {enabled ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Cada" value={km} onChangeText={setKm} format="int" suffix="km" placeholder="10.000" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="o cada" value={months} onChangeText={(t) => setMonths(t.replace(/\D/g, ''))} keyboardType="number-pad" suffix="meses" placeholder="12" />
              </View>
            </View>
          ) : null}
          <AppText variant="caption" tone="subtle">
            Valores sugeridos: {target.item.intervalKm ? `${formatInt(target.item.intervalKm)} km` : '—'} / {target.item.intervalMonths ? `${target.item.intervalMonths} meses` : '—'}. Respetá siempre el manual del fabricante.
          </AppText>
          <Button label="Guardar" icon="check" onPress={() => void save()} />
          {current?.custom ? (
            <Button
              label="Volver a los valores sugeridos"
              variant="ghost"
              onPress={async () => {
                await resetServiceRule(vehicleId, target.item.key);
                onClose();
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}
