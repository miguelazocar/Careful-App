import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { PhotoStrip, VehicleSelector } from '@/components/pickers';
import { Sheet } from '@/components/ui/overlays';
import { DateField, FieldLabel, TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Chip, Grid, Icon } from '@/components/ui/primitives';
import { createRecord, getOdometerReadings, getRecord, updateRecord, type RecordInput } from '@/db/records';
import type { RecordKind, Vehicle } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import {
  ACCESSORY_CATEGORY,
  ACCESSORY_ICONS,
  findItem,
  isOtherItem,
  MAINTENANCE_CATEGORIES,
  type Category,
} from '@/domain/maintenance';
import { formatPlate } from '@/domain/plate';
import { currentOdometer, validateOdometer } from '@/domain/schedule';
import { today } from '@/lib/dates';
import { formatAmount, formatInt, formatKm, parseAmountInput, parseIntInput } from '@/lib/format';
import { runAi } from '@/services/ai';
import { ensurePermission } from '@/services/notifications';
import { deletePhotoFiles } from '@/services/photos';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type SelectedItem = RecordInput['items'][number];

const TITLES: Record<RecordKind, string> = {
  maintenance: 'Mantenimiento o reparación',
  accessory: 'Accesorio',
  odometer: 'Actualizar kilometraje',
};

export default function RecordFormScreen() {
  const params = useLocalSearchParams<{ kind?: RecordKind; vehicleId?: string; item?: string; id?: string }>();
  const editingId = params.id;
  const { colors } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [kind, setKind] = useState<RecordKind>(params.kind ?? 'maintenance');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [odometer, setOdometer] = useState('');
  const [amount, setAmount] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lastKm, setLastKm] = useState<number | null>(null);
  const [readings, setReadings] = useState<{ date: string; km: number }[]>([]);
  const [initialKm, setInitialKm] = useState(0);
  const [openCategory, setOpenCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saved = useRef(false);
  const original = useRef<{ photos: string[]; km: number | null }>({ photos: [], km: null });
  const sessionPhotos = useRef<string[]>([]);

  // initial load
  useEffect(() => {
    const takenHere = sessionPhotos.current;
    void (async () => {
      const list = await listVehicles();
      setVehicles(list);
      if (editingId) {
        const r = await getRecord(editingId);
        if (r) {
          setKind(r.kind);
          setVehicleId(r.vehicleId);
          setDate(r.date);
          setOdometer(r.odometer !== null ? formatInt(r.odometer) : '');
          setAmount(r.amountCents !== null ? formatAmount(r.amountCents) : '');
          setWorkshop(r.workshop ?? '');
          setDescription(r.description ?? '');
          setItems(r.items.map((i) => ({ category: i.category, item: i.item, label: i.label })));
          setPhotos(r.photos.map((p) => p.path));
          original.current = { photos: r.photos.map((p) => p.path), km: r.odometer };
        }
      } else {
        const last = useSettings.getState().lastVehicleId;
        const preferred = params.vehicleId ?? (list.some((v) => v.id === last) ? last : null) ?? list[0]?.id ?? null;
        setVehicleId(preferred);
        if (params.item) {
          const meta = findItem(params.item);
          if (meta) setItems([{ category: meta.category.key, item: meta.item.key, label: meta.item.label }]);
        }
      }
      setLoaded(true);
    })();
    // remove photos taken in this session if the user leaves without saving
    return () => {
      if (!saved.current) deletePhotoFiles(takenHere);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // odometer context for the selected vehicle
  useEffect(() => {
    if (!vehicleId) return;
    const v = vehicles.find((x) => x.id === vehicleId);
    void getOdometerReadings(vehicleId).then((r) => {
      setReadings(r);
      setInitialKm(v?.initialOdometer ?? 0);
      setLastKm(currentOdometer(v?.initialOdometer ?? 0, r));
    });
  }, [vehicleId, vehicles]);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const km = parseIntInput(odometer);
  const amountCents = parseAmountInput(amount);
  const trackedByKm = items.some((i) => findItem(i.item)?.item.intervalKm);

  const toggleItem = (category: Category, key: string, label: string) => {
    setItems((prev) => (prev.some((i) => i.item === key && !isOtherItem(key)) ? prev.filter((i) => i.item !== key) : [...prev, { category: category.key, item: key, label }]));
  };

  const improve = async () => {
    if (!description.trim()) return toast('Escribí primero una descripción', 'info');
    setImproving(true);
    try {
      const labels = items.map((i) => (isOtherItem(i.item) ? i.label : (findItem(i.item)?.item.label ?? i.label)));
      const { result, provider } = await runAi((ai) => ai.improveText(description, { items: labels }));
      if (result.trim()) {
        setDescription(result.trim());
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast(provider.id === 'gemini' ? 'Texto mejorado con Gemini' : 'Texto estandarizado');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo mejorar el texto', 'error');
    } finally {
      setImproving(false);
    }
  };

  const persist = async () => {
    if (!vehicleId) return;
    setSaving(true);
    try {
      const input: RecordInput = {
        vehicleId,
        kind,
        date,
        odometer: km,
        amountCents: kind === 'odometer' ? null : amountCents,
        workshop: kind === 'odometer' ? null : workshop.trim() || null,
        description: description.trim() || null,
        items: kind === 'odometer' ? [] : items,
        photos: kind === 'odometer' ? [] : photos,
      };
      if (editingId) {
        const { removedPhotos } = await updateRecord(editingId, input);
        deletePhotoFiles(removedPhotos);
      } else {
        await createRecord(input);
      }
      saved.current = true;
      deletePhotoFiles(sessionPhotos.current.filter((p) => !photos.includes(p)));
      await useSettings.getState().set('lastVehicleId', vehicleId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(kind === 'odometer' ? 'Kilometraje actualizado' : editingId ? 'Registro actualizado' : 'Registro guardado');
      if (kind === 'maintenance' || kind === 'accessory') void ensurePermission();
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!vehicleId) return toast('Elegí un vehículo', 'info');
    if (kind === 'odometer' && km === null) return toast('Ingresá el kilometraje', 'info');
    if (kind !== 'odometer' && !items.length && !description.trim()) return toast('Elegí al menos un ítem o escribí una descripción', 'info');
    if (km !== null) {
      const problem = validateOdometer(km, date, readings, initialKm, editingId ? original.current.km : undefined);
      if (problem) {
        Alert.alert('Revisá el kilometraje', `${formatKm(km)}: ${problem}\n\n¿Guardar igual?`, [
          { text: 'Corregir', style: 'cancel' },
          { text: 'Guardar igual', onPress: () => void persist() },
        ]);
        return;
      }
    }
    void persist();
  };

  const selectedLabels = useMemo(
    () => items.map((i) => ({ ...i, display: isOtherItem(i.item) ? i.label : (findItem(i.item)?.item.label ?? i.label), color: findItem(i.item)?.category.color })),
    [items],
  );

  if (!loaded) return null;
  if (!vehicles.length) {
    return (
      <Screen header={<Header back title={TITLES[kind]} />}>
        <AppText tone="muted">Primero agregá un vehículo.</AppText>
        <Button label="Agregar vehículo" onPress={() => router.replace('/vehicle/form')} />
      </Screen>
    );
  }

  return (
    <Screen
      header={<Header back title={editingId ? 'Editar registro' : TITLES[kind]} />}
      footer={<Button label="Guardar" icon="check" size="lg" full loading={saving} onPress={save} />}>
      {vehicles.length > 1 ? (
        <View>
          <FieldLabel label="Vehículo" />
          <VehicleSelector vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
        </View>
      ) : vehicle ? (
        <AppText variant="caption" tone="muted">
          {vehicle.brand} {vehicle.model} {vehicle.plate ? `· ${formatPlate(vehicle.plate, vehicle.country)}` : ''}
        </AppText>
      ) : null}

      {kind === 'odometer' ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: 4, paddingVertical: spacing.md }}>
            <Icon name="speedometer" size={44} color={colors.primary} />
            <AppText variant="caption" tone="muted">
              Último registrado: {formatKm(lastKm)}
            </AppText>
          </View>
          <TextField label="Kilometraje actual" value={odometer} onChangeText={setOdometer} format="int" suffix="km" placeholder={lastKm ? formatInt(lastKm) : '0'} autoFocus style={{ fontSize: 24 }} />
          <DateField label="Fecha" value={date} onChange={setDate} />
          <AppText variant="caption" tone="subtle">
            Actualizar el odómetro seguido permite estimar tu uso diario y avisarte antes de cada service por kilometraje.
          </AppText>
        </View>
      ) : (
        <>
          <View>
            <FieldLabel label={kind === 'accessory' ? '¿Qué accesorio?' : '¿Qué se hizo?'} hint={items.length ? `${items.length} seleccionado${items.length > 1 ? 's' : ''}` : 'Podés elegir varios'} />
            {selectedLabels.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
                {selectedLabels.map((i, idx) => (
                  <Chip key={`${i.item}-${idx}`} size="sm" selected color={i.color ?? colors.primary} label={i.display} onRemove={() => setItems((p) => p.filter((_, j) => j !== idx))} />
                ))}
              </View>
            ) : null}
            {kind === 'maintenance' ? (
              <Grid columns={4} gap={spacing.xs}>
                {MAINTENANCE_CATEGORIES.map((c) => {
                  const count = items.filter((i) => i.category === c.key).length;
                  return <CategoryTile key={c.key} category={c} count={count} onPress={() => setOpenCategory(c)} />;
                })}
              </Grid>
            ) : (
              <Grid columns={3} gap={spacing.xs}>
                {ACCESSORY_CATEGORY.items.map((it) => {
                  const active = items.some((i) => i.item === it.key);
                  return (
                    <ItemTile
                      key={it.key}
                      icon={ACCESSORY_ICONS[it.key] ?? 'star-four-points'}
                      label={it.label}
                      active={active}
                      color={ACCESSORY_CATEGORY.color}
                      onPress={() => (isOtherItem(it.key) ? setOpenCategory(ACCESSORY_CATEGORY) : toggleItem(ACCESSORY_CATEGORY, it.key, it.label))}
                    />
                  );
                })}
              </Grid>
            )}
          </View>

          <DateField label="Fecha" value={date} onChange={setDate} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Kilometraje" value={odometer} onChangeText={setOdometer} format="int" suffix="km" placeholder={lastKm ? formatInt(lastKm) : '0'} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Monto" value={amount} onChangeText={setAmount} format="amount" placeholder="0" icon="cash" />
            </View>
          </View>
          {trackedByKm && km === null ? (
            <AppText variant="caption" tone="warning" style={{ marginTop: -12 }}>
              Sin kilometraje, el próximo service se calcula solo por fecha.
            </AppText>
          ) : null}
          <TextField label={kind === 'accessory' ? 'Comercio / instalador' : 'Taller'} value={workshop} onChangeText={setWorkshop} placeholder="Opcional" icon="store-outline" />
          <TextField
            label="Descripción"
            labelRight={
              <Pressable onPress={() => void improve()} disabled={improving} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: colors.accentSoft }}>
                <Icon name="star-four-points" size={14} color={colors.accent} />
                <AppText variant="captionStrong" color={colors.accent} style={{ fontSize: 12 }}>
                  {improving ? 'Mejorando…' : 'Mejorar texto'}
                </AppText>
              </Pressable>
            }
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Ej: le cambié el aceite 5w30 y el filtro, revisaron frenos"
          />
          <View>
            <FieldLabel label="Fotos" hint="Factura, repuestos, el trabajo terminado…" />
            <PhotoStrip
              photos={photos}
              onChange={(next) => {
                next.filter((p) => !photos.includes(p) && !original.current.photos.includes(p)).forEach((p) => sessionPhotos.current.push(p));
                setPhotos(next);
              }}
            />
          </View>
        </>
      )}

      <CategorySheet
        category={openCategory}
        selected={items}
        onClose={() => setOpenCategory(null)}
        onToggle={toggleItem}
        onAddOther={(cat, text) => setItems((p) => [...p, { category: cat.key, item: `${cat.key}.otro`, label: text }])}
      />
    </Screen>
  );
}

function CategoryTile({ category, count, onPress }: { category: Category; count: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={category.label}
      style={({ pressed }) => ({
        aspectRatio: 0.92,
        borderRadius: radius.lg,
        backgroundColor: count ? category.color + '1F' : colors.surface,
        borderWidth: count ? 2 : 1,
        borderColor: count ? category.color : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 4,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: category.color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={category.icon} size={22} color="#fff" />
      </View>
      <AppText variant="caption" align="center" numberOfLines={2} style={{ fontSize: 11, lineHeight: 13 }}>
        {category.label}
      </AppText>
      {count ? (
        <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: category.color, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <AppText variant="captionStrong" color="#fff" style={{ fontSize: 11, lineHeight: 13 }}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

function ItemTile({ icon, label, active, color, onPress }: { icon: string; label: string; active: boolean; color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 86,
        borderRadius: radius.lg,
        backgroundColor: active ? color + '22' : colors.surface,
        borderWidth: active ? 2 : 1,
        borderColor: active ? color : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 6,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}>
      <Icon name={icon} size={26} color={active ? color : colors.textMuted} />
      <AppText variant="caption" align="center" numberOfLines={2} style={{ fontSize: 12, lineHeight: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function CategorySheet({
  category,
  selected,
  onClose,
  onToggle,
  onAddOther,
}: {
  category: Category | null;
  selected: SelectedItem[];
  onClose: () => void;
  onToggle: (c: Category, key: string, label: string) => void;
  onAddOther: (c: Category, text: string) => void;
}) {
  const [other, setOther] = useState('');
  return (
    <Sheet visible={!!category} onClose={onClose} title={category?.label}>
      {category ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {category.items
              .filter((i) => !isOtherItem(i.key))
              .map((i) => (
                <Chip key={i.key} label={i.label} color={category.color} selected={selected.some((s) => s.item === i.key)} onPress={() => onToggle(category, i.key, i.label)} icon={i.intervalKm || i.intervalMonths ? 'calendar-clock' : undefined} />
              ))}
          </View>
          <TextField
            value={other}
            onChangeText={setOther}
            placeholder="Otro (escribilo)"
            icon="pencil"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!other.trim()) return;
              onAddOther(category, other.trim());
              setOther('');
            }}
            right={
              other.trim() ? (
                <Button
                  label="Agregar"
                  size="sm"
                  onPress={() => {
                    onAddOther(category, other.trim());
                    setOther('');
                  }}
                />
              ) : undefined
            }
          />
          <AppText variant="caption" tone="subtle">
            Los ítems con reloj agendan automáticamente el próximo service.
          </AppText>
          <Button label="Listo" onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}
