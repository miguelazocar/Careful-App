import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { IntervalFields, monthsUnit } from '@/components/IntervalFields';
import { PhotoStrip, VehicleSelector } from '@/components/pickers';
import { openQuickRecord } from '@/components/QuickRecord';
import { DateField, FieldLabel, TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Chip, Grid, Icon } from '@/components/ui/primitives';
import { createRecord, getOdometerReadings, getRecord, updateRecord, type RecordInput, type RecordItemInput } from '@/db/records';
import { getServiceRules } from '@/db/reminders';
import type { ServiceRule, Vehicle } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { CORE_ITEM, findItem, isOtherItem, isTrackedItem, MAINTENANCE_CATEGORIES, OIL_CHANGE_EXTRAS, PLAN_ITEMS, planItem, type Category } from '@/domain/maintenance';
import { dueText } from '@/domain/notification-plan';
import { currentOdometer, nextDueFrom, odometerError, resolveInterval, validateOdometer } from '@/domain/schedule';
import { today } from '@/lib/dates';
import { formatAmount, formatInt, formatKm, parseAmountInput, parseIntInput } from '@/lib/format';
import { runAi } from '@/services/ai';
import { ensurePermission } from '@/services/notifications';
import { deletePhotoFiles } from '@/services/photos';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * Registrar un servicio / mantenimiento.
 * 1) «¿Qué se hizo?»: grilla de categorías; cada una abre sus tareas (se pueden elegir varias).
 * 2) Las tareas del plan de mantenimiento (aceite, filtros, bujías, distribución) piden cada
 *    cuántos km y meses toca la próxima, precargado con el plan del vehículo.
 * 3) Siempre: kilometraje, monto, descripción y foto opcional.
 * Accesorios y kilometraje usan los modales rápidos (components/QuickRecord).
 */

interface Interval {
  km: string;
  months: number;
}

const enter = FadeIn.duration(220).easing(Easing.out(Easing.cubic));
const labelOf = (i: { item: string; label: string }) => (isOtherItem(i.item) ? i.label : (findItem(i.item)?.item.label ?? i.label));

export default function RecordFormScreen() {
  const params = useLocalSearchParams<{ kind?: string; vehicleId?: string; item?: string; id?: string }>();
  const editingId = params.id;
  const { colors } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [rules, setRules] = useState<ServiceRule[]>([]);
  const [items, setItems] = useState<RecordItemInput[]>([]);
  const [intervals, setIntervals] = useState<Record<string, Interval>>({});
  const [date, setDate] = useState(today());
  const [odometer, setOdometer] = useState('');
  const [amount, setAmount] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [readings, setReadings] = useState<{ date: string; km: number }[]>([]);
  const [openCategory, setOpenCategory] = useState<Category | null>(null);
  /** Interval cards the user expanded ("Cambiar"). */
  const [openIntervals, setOpenIntervals] = useState<Record<string, boolean>>({});
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
        if (r && r.kind !== 'maintenance') {
          // accessories and odometer readings are edited in their quick modal
          openQuickRecord({ kind: r.kind, recordId: r.id });
          router.back();
          return;
        }
        if (r) {
          setVehicleId(r.vehicleId);
          setDate(r.date);
          setOdometer(r.odometer !== null ? formatInt(r.odometer) : '');
          setAmount(r.amountCents !== null ? formatAmount(r.amountCents) : '');
          setWorkshop(r.workshop ?? '');
          setDescription(r.description ?? '');
          setItems(r.items.map((i) => ({ category: i.category, item: i.item, label: i.label, intervalKm: i.intervalKm, intervalMonths: i.intervalMonths })));
          setIntervals(
            Object.fromEntries(
              r.items.filter((i) => i.intervalKm !== null || i.intervalMonths !== null).map((i) => [i.item, { km: i.intervalKm ? formatInt(i.intervalKm) : '', months: i.intervalMonths ?? 0 }]),
            ),
          );
          setPhotos(r.photos.map((p) => p.path));
          original.current = { photos: r.photos.map((p) => p.path), km: r.odometer };
        }
      } else {
        if (params.kind === 'accessory' || params.kind === 'odometer') {
          openQuickRecord({ kind: params.kind, vehicleId: params.vehicleId });
          router.back();
          return;
        }
        const last = useSettings.getState().lastVehicleId;
        setVehicleId(params.vehicleId ?? (list.some((v) => v.id === last) ? last : null) ?? list[0]?.id ?? null);
        const meta = params.item ? findItem(params.item) : undefined;
        if (meta) setItems([{ category: meta.category.key, item: meta.item.key, label: meta.item.label }]);
      }
      setLoaded(true);
    })();
    // remove photos taken in this session if the user leaves without saving
    return () => {
      if (!saved.current) deletePhotoFiles(takenHere);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // odometer history and service plan of the selected vehicle
  useEffect(() => {
    if (!vehicleId) return;
    void Promise.all([getOdometerReadings(vehicleId), getServiceRules(vehicleId)]).then(([r, rl]) => {
      setReadings(r);
      setRules(rl);
    });
  }, [vehicleId]);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const lastKm = vehicle ? currentOdometer(vehicle.initialOdometer, readings) : null;
  const km = parseIntInput(odometer);
  // plan order: the oil change (with its extra filters) first
  const planIndex = (item: string) => PLAN_ITEMS.findIndex((p) => p.item === item);
  const tracked = items.filter((i) => isTrackedItem(i.item)).sort((a, b) => planIndex(a.item) - planIndex(b.item));

  /** The interval shown for a tracked item: what the user set, else the vehicle's plan. */
  const intervalOf = (item: string): Interval => {
    const own = intervals[item];
    if (own) return own;
    const plan = resolveInterval(item, rules);
    return { km: plan.intervalKm ? formatInt(plan.intervalKm) : '', months: plan.intervalMonths ?? 0 };
  };

  const toggle = (category: string, item: string, label: string) =>
    setItems((prev) => (prev.some((i) => i.item === item && !isOtherItem(item)) ? prev.filter((i) => i.item !== item) : [...prev, { category, item, label }]));

  const improve = async () => {
    if (!description.trim()) return toast('Escribí primero una descripción', 'info');
    setImproving(true);
    try {
      const { result, provider } = await runAi((ai) => ai.improveText(description, { items: items.map(labelOf) }));
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
        kind: 'maintenance',
        date,
        odometer: km,
        amountCents: parseAmountInput(amount),
        workshop: workshop.trim() || null,
        description: description.trim() || null,
        // tracked services keep the interval chosen here: it rules the next one
        items: items.map((i) => {
          if (!isTrackedItem(i.item)) return { ...i, intervalKm: null, intervalMonths: null };
          const iv = intervalOf(i.item);
          return { ...i, intervalKm: parseIntInput(iv.km), intervalMonths: iv.months || null };
        }),
        photos,
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
      toast(editingId ? 'Registro actualizado' : tracked.length ? 'Service guardado. Agendamos el próximo.' : 'Registro guardado');
      void ensurePermission();
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!vehicleId) return toast('Elegí un vehículo', 'info');
    if (!items.length) return toast('Elegí qué se hizo', 'info');
    if (km === null && !(editingId && original.current.km === null)) return toast('Ingresá el kilometraje actual', 'info');
    const impossible = km !== null ? odometerError(km) : null;
    if (impossible) return toast(impossible, 'error');
    for (const t of tracked) {
      const iv = intervalOf(t.item);
      if (!parseIntInput(iv.km) && !iv.months) return toast(`Indicá cada cuántos km o meses toca: ${labelOf(t)}`, 'info');
    }
    if (km !== null) {
      const problem = validateOdometer(km, date, readings, vehicle?.initialOdometer ?? 0, editingId ? original.current.km : undefined);
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

  if (!loaded) return null;
  if (!vehicles.length) {
    return (
      <Screen header={<Header back title="Registrar servicio" />}>
        <AppText tone="muted">Primero agregá un vehículo.</AppText>
        <Button label="Agregar vehículo" onPress={() => router.replace('/vehicle/form')} />
      </Screen>
    );
  }

  const vehiclePicker =
    vehicles.length > 1 ? (
      <VehicleSelector vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
    ) : vehicle ? (
      <AppText variant="caption" tone="muted">
        {vehicle.brand} {vehicle.model} · {formatKm(lastKm)}
      </AppText>
    ) : null;

  return (
    <Screen
      header={<Header back title={editingId ? 'Editar servicio' : 'Registrar servicio'} />}
      footer={<Button label="Guardar" icon="check" size="lg" full loading={saving} onPress={save} />}>
      {!editingId ? vehiclePicker : null}

      <View>
        <FieldLabel label="¿Qué se hizo?" hint={items.length ? `${items.length} seleccionado${items.length > 1 ? 's' : ''}` : 'Podés elegir varios'} />
        {items.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
            {items.map((i, idx) => (
              <Chip
                key={`${i.item}-${idx}`}
                size="sm"
                selected
                color={findItem(i.item)?.category.color ?? colors.primary}
                label={labelOf(i)}
                onRemove={() => setItems((p) => p.filter((x) => x !== i))}
              />
            ))}
          </View>
        ) : null}
        <Grid columns={4} gap={spacing.xs}>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <CategoryTile key={c.key} category={c} count={items.filter((i) => i.category === c.key).length} onPress={() => setOpenCategory(c)} />
          ))}
        </Grid>
      </View>

      {tracked.map((t) => {
        const iv = intervalOf(t.item);
        const next = nextDueFrom(date, km, { intervalKm: parseIntInput(iv.km), intervalMonths: iv.months || null });
        const when = dueText(next);
        const plan = planItem(t.item);
        // the oil change always shows its fields; the rest open on demand when there are several
        const full = t.item === CORE_ITEM || tracked.length === 1 || openIntervals[t.item];
        const every = [iv.km ? `${iv.km} km` : null, iv.months ? `${iv.months} ${monthsUnit(iv.months)}` : null].filter(Boolean).join(' o ');
        return (
          <Animated.View key={t.item} entering={enter} style={{ gap: full ? spacing.sm : 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name={plan?.icon ?? 'calendar-sync'} size={20} color={plan?.color ?? colors.primary} />
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                Próximo: {labelOf(t).toLowerCase()}
              </AppText>
              {!full ? (
                <Pressable onPress={() => setOpenIntervals((p) => ({ ...p, [t.item]: true }))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Cambiar el intervalo de ${labelOf(t)}`}>
                  <AppText variant="captionStrong" tone="primary">
                    Cambiar
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            {full ? (
              <IntervalFields km={iv.km} months={iv.months} onKm={(v) => setIntervals((p) => ({ ...p, [t.item]: { ...iv, km: v } }))} onMonths={(v) => setIntervals((p) => ({ ...p, [t.item]: { ...iv, months: v } }))} />
            ) : null}
            <AppText variant="caption" tone="muted">
              {!full && every ? `Cada ${every}. ` : ''}
              {when ? `Te avisamos para hacerlo ${when}.` : 'Cargá el kilometraje para calcular el próximo.'}
            </AppText>
            {t.item === CORE_ITEM ? (
              <View style={{ gap: 6, marginTop: 2 }}>
                <AppText variant="captionStrong">¿También cambiaste?</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {OIL_CHANGE_EXTRAS.map((key) => {
                    const meta = findItem(key);
                    if (!meta) return null;
                    const on = items.some((i) => i.item === key);
                    return (
                      <Chip
                        key={key}
                        size="sm"
                        icon={on ? 'check' : planItem(key)?.icon}
                        color={planItem(key)?.color}
                        label={meta.item.label}
                        selected={on}
                        onPress={() => toggle(meta.category.key, key, meta.item.label)}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
          </Animated.View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Kilometraje" value={odometer} onChangeText={setOdometer} format="int" suffix="km" placeholder={lastKm ? formatInt(lastKm) : '0'} icon="speedometer" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Monto" value={amount} onChangeText={setAmount} format="amount" placeholder="0" icon="cash" />
        </View>
      </View>
      <DateField label="Fecha" value={date} onChange={setDate} />
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
        placeholder="Ej: aceite 5W-30 sintético y filtro, revisaron niveles"
      />
      <TextField label="Taller" value={workshop} onChangeText={setWorkshop} placeholder="Opcional" icon="store-outline" />
      <View>
        <FieldLabel label="Fotos y archivos" hint="Opcional: foto del trabajo, factura en PDF, garantía…" />
        <PhotoStrip
          photos={photos}
          onChange={(next) => {
            next.filter((p) => !photos.includes(p) && !original.current.photos.includes(p)).forEach((p) => sessionPhotos.current.push(p));
            setPhotos(next);
          }}
        />
      </View>

      <CategorySheet
        category={openCategory}
        selected={items}
        onClose={() => setOpenCategory(null)}
        onToggle={(c, key, label) => toggle(c.key, key, label)}
        onAddOther={(cat, text) => setItems((p) => [...p, { category: cat.key, item: `${cat.key}.otro`, label: text }])}
      />
    </Screen>
  );
}

/* ------------------------------ Building blocks ------------------------------ */

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

function CategorySheet({
  category,
  selected,
  onClose,
  onToggle,
  onAddOther,
}: {
  category: Category | null;
  selected: RecordItemInput[];
  onClose: () => void;
  onToggle: (c: Category, key: string, label: string) => void;
  onAddOther: (c: Category, text: string) => void;
}) {
  const [other, setOther] = useState('');
  const add = () => {
    if (!category || !other.trim()) return;
    onAddOther(category, other.trim());
    setOther('');
  };
  return (
    <Sheet visible={!!category} onClose={onClose} title={category?.label}>
      {category ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {category.items
              .filter((i) => !isOtherItem(i.key))
              .map((i) => (
                <Chip
                  key={i.key}
                  label={i.label}
                  color={category.color}
                  selected={selected.some((s) => s.item === i.key)}
                  onPress={() => onToggle(category, i.key, i.label)}
                  icon={i.intervalKm || i.intervalMonths ? 'calendar-clock' : undefined}
                />
              ))}
          </View>
          <TextField
            value={other}
            onChangeText={setOther}
            placeholder="Otro (escribilo)"
            icon="pencil"
            returnKeyType="done"
            onSubmitEditing={add}
            right={other.trim() ? <Button label="Agregar" size="sm" onPress={add} /> : undefined}
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
