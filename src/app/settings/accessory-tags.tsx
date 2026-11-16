import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Icon } from '@/components/ui/primitives';
import { getAccessoryTagCounts } from '@/db/records';
import { activeAccessoryTags, addAccessoryTag, removeAccessoryTag, restoreSuggestedTags, type AccessoryTagDef } from '@/domain/accessory-tags';
import { useQuery } from '@/hooks/useQuery';
import { newId } from '@/lib/id';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/** Ajustes › Etiquetas de accesorios: add your own tags or remove the ones you don't use. */
export default function AccessoryTagsScreen() {
  const { colors } = useTheme();
  const prefs = useSettings((s) => s.accessoryTags);
  const [name, setName] = useState('');
  const { data: counts } = useQuery(async () => new Map((await getAccessoryTagCounts()).map((t) => [t.item, t.count])), []);
  const tags = activeAccessoryTags(prefs);
  const save = (next: typeof prefs) => useSettings.getState().set('accessoryTags', next);

  const add = async () => {
    const r = addAccessoryTag(prefs, name, newId);
    if (!r.ok) return toast(r.error, 'info');
    await save(r.prefs);
    setName('');
    toast(r.restored ? 'Etiqueta recuperada' : 'Etiqueta agregada');
  };

  const remove = (t: AccessoryTagDef) => {
    const used = counts?.get(t.key) ?? 0;
    Alert.alert(
      `Quitar «${t.label}»`,
      used
        ? `${used === 1 ? 'Un accesorio la usa y la conserva' : `${used} accesorios la usan y la conservan`} en su historial, pero ya no vas a poder elegirla para nuevos.`
        : 'Ya no vas a poder elegirla para nuevos accesorios.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            await save(removeAccessoryTag(prefs, t.key));
            toast('Etiqueta quitada');
          },
        },
      ],
    );
  };

  return (
    <Screen header={<Header back title="Etiquetas de accesorios" />}>
      <AppText variant="body" tone="muted">
        Clasifican los accesorios para encontrarlos y filtrar el historial. Agregá las tuyas o quitá las que no uses.
      </AppText>

      <TextField
        label="Nueva etiqueta"
        value={name}
        onChangeText={setName}
        placeholder="Ej. Portabicicletas"
        icon="tag-plus-outline"
        maxLength={30}
        returnKeyType="done"
        onSubmitEditing={() => void add()}
        right={name.trim() ? <Button label="Agregar" size="sm" onPress={() => void add()} /> : undefined}
      />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="overline" tone="muted">
          {tags.length} {tags.length === 1 ? 'etiqueta' : 'etiquetas'}
        </AppText>
        <Card padded={false}>
          {tags.length ? (
            tags.map((t, i) => {
              const used = counts?.get(t.key) ?? 0;
              return (
                <View
                  key={t.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingLeft: spacing.md,
                    paddingRight: spacing.xs,
                    paddingVertical: 8,
                    borderBottomWidth: i === tags.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#0FA57D1F', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={t.icon} size={18} color="#0FA57D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {t.label}
                    </AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {[t.custom ? 'Tuya' : 'Sugerida', used ? `${used} ${used === 1 ? 'accesorio' : 'accesorios'}` : null].filter(Boolean).join(' · ')}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() => remove(t)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${t.label}`}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
                    <Icon name="trash-can-outline" size={22} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })
          ) : (
            <AppText variant="body" tone="muted" style={{ padding: spacing.md }}>
              No hay etiquetas. Agregá la primera arriba.
            </AppText>
          )}
        </Card>
      </View>

      {prefs.hidden.length ? (
        <Button
          label={`Recuperar las sugeridas que quitaste (${prefs.hidden.length})`}
          variant="ghost"
          icon="restore"
          onPress={async () => {
            await save(restoreSuggestedTags(prefs));
            toast('Etiquetas sugeridas recuperadas');
          }}
        />
      ) : null}
    </Screen>
  );
}
