import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';

import { Sheet } from '@/components/ui/overlays';
import { DateField, FieldLabel, TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, Chip, Grid, Icon, ListRow } from '@/components/ui/primitives';
import {
  BRANDS,
  getBrand,
  getEngine,
  getModel,
  matchBrand,
  maxCatalogYear,
  modelsFor,
  normalizeText,
  variantsFor,
  yearsForBrand,
  type CatalogModel,
} from '@/data/catalog';
import { createRecord } from '@/db/records';
import { createVehicle, getVehicle, updateVehicle, type VehicleInput } from '@/db/vehicles';
import { colorHexFor, isLightColor, VEHICLE_COLORS } from '@/domain/colors';
import { COUNTRIES, flagEmoji } from '@/domain/countries';
import { formatPlate, normalizePlate } from '@/domain/plate';
import { isValidVin, normalizeVin, vinBrandId, vinModelYear } from '@/domain/vin';
import { today } from '@/lib/dates';
import { formatInt, parseIntInput } from '@/lib/format';
import { fluidsFromCatalog, runAi, type VehicleGuess } from '@/services/ai';
import { ensurePermission } from '@/services/notifications';
import { deletePhotoFiles, pickPhoto, photoUri } from '@/services/photos';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Level = 'brand' | 'year' | 'model' | 'variant' | 'color' | 'done';

interface Draft {
  photo: string | null;
  brandId: string | null;
  brand: string;
  year: number | null;
  modelId: string | null;
  model: string;
  variant: string | null;
  engineId: string | null;
  fuel: string | null;
  color: string | null;
  colorHex: string | null;
  plate: string;
  country: string;
  vin: string;
  engineNumber: string;
  odometer: string;
  nickname: string;
  oilType: string;
  oilLiters: string;
  coolantType: string;
  coolantLiters: string;
  lastOilDate: string;
  lastOilKm: string;
  withLastOil: boolean;
}

const EMPTY: Draft = {
  photo: null,
  brandId: null,
  brand: '',
  year: null,
  modelId: null,
  model: '',
  variant: null,
  engineId: null,
  fuel: null,
  color: null,
  colorHex: null,
  plate: '',
  country: 'AR',
  vin: '',
  engineNumber: '',
  odometer: '',
  nickname: '',
  oilType: '',
  oilLiters: '',
  coolantType: '',
  coolantLiters: '',
  lastOilDate: today(),
  lastOilKm: '',
  withLastOil: false,
};

const STEPS = ['Tu auto', 'Registro', 'Fluidos'];
const OIL_TYPES = ['5W-30', '5W-40', '10W-40', '15W-40', '0W-20', '5W-20', '0W-30'];
const COOLANT_TYPES = ['Orgánico (OAT) rosa', 'Orgánico G12/G13', 'Inorgánico verde', 'Long Life azul'];
const FUELS: { value: string; label: string }[] = [
  { value: 'nafta', label: 'Nafta' },
  { value: 'diesel', label: 'Diésel' },
  { value: 'gnc', label: 'GNC' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'electrico', label: 'Eléctrico' },
];

const decimal = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Level>('brand');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [initialPhoto, setInitialPhoto] = useState<string | null>(null);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!id) return;
    void getVehicle(id).then((v) => {
      if (!v) return;
      setInitialPhoto(v.photo);
      setDraft({
        ...EMPTY,
        photo: v.photo,
        brandId: v.brandId,
        brand: v.brand,
        year: v.year,
        modelId: v.modelId,
        model: v.model,
        variant: v.variant,
        engineId: v.engineId,
        fuel: v.fuel,
        color: v.color,
        colorHex: v.colorHex,
        plate: formatPlate(v.plate, v.country),
        country: v.country,
        vin: v.vin ?? '',
        engineNumber: v.engineNumber ?? '',
        odometer: formatInt(v.initialOdometer),
        nickname: v.nickname ?? '',
        oilType: v.oilType ?? '',
        oilLiters: v.oilLiters ? String(v.oilLiters).replace('.', ',') : '',
        coolantType: v.coolantType ?? '',
        coolantLiters: v.coolantLiters ? String(v.coolantLiters).replace('.', ',') : '',
      });
      setLevel('done');
      setLoaded(true);
    });
  }, [id]);

  const applyGuess = (g: VehicleGuess) => {
    setDraft((d) => {
      const next = { ...d };
      if (g.plate) next.plate = formatPlate(g.plate, d.country);
      if (g.vin) next.vin = g.vin;
      if (g.engineNumber) next.engineNumber = g.engineNumber;
      if (g.brandId || g.brand) {
        next.brandId = g.brandId ?? null;
        next.brand = g.brand ?? getBrand(g.brandId)?.name ?? d.brand;
      }
      if (g.year) next.year = g.year;
      if (g.model) {
        next.model = g.model;
        next.modelId = g.modelId ?? null;
      }
      if (g.variant) {
        next.variant = g.variant;
        next.engineId = g.engineId ?? null;
        const eng = getEngine(next.brandId, next.engineId);
        if (eng) next.fuel = eng.fuel;
      }
      if (g.color) {
        next.color = g.color;
        next.colorHex = colorHexFor(g.color);
      }
      return next;
    });
    setLevel((lv) => {
      const d = { ...draft, ...g };
      if (!(d.brand || g.brand)) return 'brand';
      if (!(d.year || g.year)) return 'year';
      if (!(d.model || g.model)) return 'model';
      if (!(d.color || g.color)) return lv === 'done' ? 'done' : 'color';
      return 'done';
    });
  };

  const validStep0 = !!draft.brand.trim() && !!draft.model.trim();
  const odometer = parseIntInput(draft.odometer);
  const validStep1 = odometer !== null;

  const next = () => {
    if (step === 0 && !validStep0) return toast('Elegí al menos la marca y el modelo', 'info');
    if (step === 1 && !validStep1) return toast('Ingresá el kilometraje actual', 'info');
    setStep((s) => s + 1);
  };

  const save = async () => {
    if (!validStep0 || odometer === null) return;
    const lastOilKm = parseIntInput(draft.lastOilKm);
    if (!editing && draft.withLastOil && lastOilKm !== null && lastOilKm > odometer) {
      return toast('El kilometraje del último cambio no puede superar el actual', 'error');
    }
    setSaving(true);
    try {
      const input: VehicleInput = {
        nickname: draft.nickname.trim() || null,
        brand: draft.brand.trim(),
        brandId: draft.brandId,
        model: draft.model.trim(),
        modelId: draft.modelId,
        year: draft.year,
        variant: draft.variant?.trim() || null,
        engineId: draft.engineId,
        fuel: draft.fuel,
        color: draft.color,
        colorHex: draft.colorHex,
        plate: normalizePlate(draft.plate) || null,
        country: draft.country,
        vin: draft.vin ? normalizeVin(draft.vin) : null,
        engineNumber: draft.engineNumber.trim().toUpperCase() || null,
        photo: draft.photo,
        initialOdometer: odometer,
        oilType: draft.oilType.trim() || null,
        oilLiters: decimal(draft.oilLiters),
        coolantType: draft.coolantType.trim() || null,
        coolantLiters: decimal(draft.coolantLiters),
        notes: null,
      };
      let vehicleId = id;
      if (editing && id) {
        await updateVehicle(id, input);
        if (initialPhoto && initialPhoto !== draft.photo) deletePhotoFiles([initialPhoto]);
      } else {
        const v = await createVehicle(input);
        vehicleId = v.id;
        const lastKm = parseIntInput(draft.lastOilKm);
        if (draft.withLastOil) {
          await createRecord({
            vehicleId: v.id,
            kind: 'maintenance',
            date: draft.lastOilDate,
            odometer: lastKm,
            amountCents: null,
            workshop: null,
            description: 'Registro inicial cargado al dar de alta el vehículo.',
            items: [
              { category: 'motor', item: 'motor.aceite', label: 'Cambio de aceite' },
              { category: 'motor', item: 'motor.filtro_aceite', label: 'Filtro de aceite' },
            ],
            photos: [],
          });
        }
        await useSettings.getState().set('lastVehicleId', v.id);
        void ensurePermission();
      }
      toast(editing ? 'Vehículo actualizado' : '¡Vehículo agregado!');
      if (editing) router.back();
      else router.replace({ pathname: '/vehicle/[id]', params: { id: vehicleId! } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <Screen
      header={
        <View>
          <Header
            back
            title={editing ? 'Editar vehículo' : 'Nuevo vehículo'}
            onBack={() => (step > 0 ? setStep(step - 1) : router.back())}
          />
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            {STEPS.map((s, i) => (
              <Pressable key={s} style={{ flex: 1, gap: 4 }} onPress={() => (i < step || (i === step + 1 && (step !== 0 || validStep0)) ? setStep(i) : undefined)}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.primary : colors.border }} />
                <AppText variant="caption" tone={i === step ? 'primary' : 'subtle'} style={{ fontSize: 12 }}>
                  {i + 1}. {s}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      }
      footer={
        step < 2 ? (
          <Button label="Continuar" icon="arrow-right" size="lg" full onPress={next} disabled={step === 0 ? !validStep0 : !validStep1} />
        ) : (
          <Button label={editing ? 'Guardar cambios' : 'Guardar vehículo'} icon="check" size="lg" full loading={saving} onPress={() => void save()} />
        )
      }>
      {step === 0 ? (
        <IdentityStep draft={draft} set={set} level={level} setLevel={setLevel} onGuess={applyGuess} />
      ) : step === 1 ? (
        <RegistrationStep draft={draft} set={set} />
      ) : (
        <FluidsStep draft={draft} set={set} editing={editing} />
      )}
    </Screen>
  );
}

/* ================================ Step 1 ================================ */

function IdentityStep({ draft, set, level, setLevel, onGuess }: { draft: Draft; set: (p: Partial<Draft>) => void; level: Level; setLevel: (l: Level) => void; onGuess: (g: VehicleGuess) => void }) {
  const { colors } = useTheme();
  const [photoSheet, setPhotoSheet] = useState(false);
  const [busy, setBusy] = useState<null | 'card' | 'photo'>(null);

  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoSheet(false);
    try {
      const p = await pickPhoto(source, { edit: true, aspect: [4, 3] });
      if (p) set({ photo: p.path });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar la foto', 'error');
    }
  };

  const scanCard = async () => {
    try {
      const p = await pickPhoto('camera');
      if (!p) return;
      setBusy('card');
      const { result, provider } = await runAi((ai) => ai.scanRegistration(p.uri));
      deletePhotoFiles([p.path]);
      const found = Object.values(result).filter(Boolean).length;
      if (!found) return toast('No pudimos leer la cédula. Probá con más luz y sin reflejos.', 'info');
      onGuess(result);
      toast(`Datos completados (${provider.id === 'gemini' ? 'IA en la nube' : 'IA en el teléfono'}). Revisalos.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo analizar la cédula', 'error');
    } finally {
      setBusy(null);
    }
  };

  const analyzePhoto = async () => {
    const uri = photoUri(draft.photo);
    if (!uri) return setPhotoSheet(true);
    try {
      setBusy('photo');
      const { result } = await runAi((ai) => ai.analyzeVehiclePhoto(uri));
      const { brand, brandId, model, modelId, ...rest } = result;
      // from a photo we only trust plate & color, and brand/model when nothing was chosen yet
      onGuess({ ...rest, ...(draft.brand ? {} : { brand, brandId, model, modelId }) });
      toast(result.plate || result.color ? 'Detectamos datos en la foto. Revisalos.' : 'No se detectó la patente ni el color.', result.plate || result.color ? 'success' : 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo analizar la foto', 'error');
    } finally {
      setBusy(null);
    }
  };

  const uri = photoUri(draft.photo);
  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable onPress={() => setPhotoSheet(true)} style={{ height: 190, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
        {uri ? (
          <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={200} />
        ) : (
          <LinearGradient colors={[colors.primarySoft, colors.surface]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera-plus" size={30} color="#fff" />
            </View>
            <AppText variant="bodyStrong" tone="primary">
              Agregar foto del auto
            </AppText>
          </LinearGradient>
        )}
        {uri ? (
          <View style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Icon name="pencil" size={16} color="#fff" />
            <AppText variant="captionStrong" color="#fff">
              Cambiar
            </AppText>
          </View>
        ) : null}
      </Pressable>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <AiButton icon="card-account-details-outline" label="Leer cédula" sub="Completa todo" busy={busy === 'card'} onPress={() => void scanCard()} />
        <AiButton icon="text-recognition" label="Leer foto" sub="Patente y color" busy={busy === 'photo'} onPress={() => void analyzePhoto()} />
      </View>

      <VehicleSelector draft={draft} set={set} level={level} setLevel={setLevel} />

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Foto del vehículo">
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <ListRow icon="camera" title="Tomar foto" onPress={() => void choosePhoto('camera')} />
          <ListRow icon="image" title="Elegir de la galería" onPress={() => void choosePhoto('library')} last={!draft.photo} />
          {draft.photo ? <ListRow icon="delete-outline" title="Quitar foto" danger last onPress={() => { setPhotoSheet(false); set({ photo: null }); }} /> : null}
        </View>
      </Sheet>
    </View>
  );
}

function AiButton({ icon, label, sub, busy, onPress }: { icon: string; label: string; sub: string; busy: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
      })}>
      <LinearGradient colors={['#2EE8B6', '#0B63F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name={icon} size={20} color="#fff" />}
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <AppText variant="captionStrong" numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="caption" tone="muted" style={{ fontSize: 11 }} numberOfLines={1}>
          ✨ {sub}
        </AppText>
      </View>
    </Pressable>
  );
}

/** brand → year → model → variant → color, one level at a time, each tap advances. */
function VehicleSelector({ draft, set, level, setLevel }: { draft: Draft; set: (p: Partial<Draft>) => void; level: Level; setLevel: (l: Level) => void }) {
  const { colors } = useTheme();
  const [custom, setCustom] = useState('');
  const [query, setQuery] = useState('');

  // reset the free-text inputs whenever the selector moves to another level
  const [prevLevel, setPrevLevel] = useState(level);
  if (level !== prevLevel) {
    setPrevLevel(level);
    setCustom('');
    setQuery('');
  }

  const brand = getBrand(draft.brandId);
  const years = useMemo(() => {
    if (brand) return yearsForBrand(brand.id);
    const out: number[] = [];
    for (let y = maxCatalogYear(); y >= 2000; y--) out.push(y);
    return out;
  }, [brand]);
  const models = useMemo(() => (brand ? modelsFor(brand.id, draft.year) : []), [brand, draft.year]);
  const model: CatalogModel | undefined = getModel(draft.brandId, draft.modelId);
  const variants = useMemo(() => (model ? variantsFor(model, draft.year) : []), [model, draft.year]);

  const crumbs: { level: Level; label: string | null }[] = [
    { level: 'brand', label: draft.brand || null },
    { level: 'year', label: draft.year ? String(draft.year) : null },
    { level: 'model', label: draft.model || null },
    { level: 'variant', label: draft.variant },
    { level: 'color', label: draft.color },
  ];

  const filteredModels = query ? models.filter((m) => normalizeText(m.name).includes(normalizeText(query))) : models;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {crumbs.map((c) => (
          <Chip
            key={c.level}
            size="sm"
            label={c.label ?? { brand: 'Marca', year: 'Año', model: 'Modelo', variant: 'Versión', color: 'Color' }[c.level as Exclude<Level, 'done'>]}
            selected={level === c.level}
            icon={c.label ? 'check' : undefined}
            onPress={() => setLevel(c.level)}
          />
        ))}
      </View>

      {level === 'brand' ? (
        <Animated.View entering={FadeInRight.duration(200)} style={{ gap: spacing.sm }}>
          <AppText variant="heading">¿Qué marca es?</AppText>
          <Grid columns={2}>
            {BRANDS.map((b) => (
              <Tile
                key={b.id}
                label={b.name}
                selected={draft.brandId === b.id}
                onPress={() => {
                  const changed = draft.brandId !== b.id;
                  set({ brandId: b.id, brand: b.name, ...(changed ? { modelId: null, model: '', variant: null, engineId: null } : {}) });
                  setLevel('year');
                }}
              />
            ))}
          </Grid>
          <CustomEntry
            placeholder="Otra marca"
            value={custom}
            onChange={setCustom}
            onSubmit={() => {
              const match = matchBrand(custom);
              set({ brandId: match?.id ?? null, brand: match?.name ?? custom.trim(), modelId: null, model: '', variant: null, engineId: null });
              setLevel('year');
            }}
          />
        </Animated.View>
      ) : null}

      {level === 'year' ? (
        <Animated.View entering={FadeInRight.duration(200)} style={{ gap: spacing.sm }}>
          <AppText variant="heading">¿De qué año?</AppText>
          <Grid columns={4} gap={spacing.xs}>
            {years.map((y) => (
              <Pressable
                key={y}
                onPress={() => {
                  set({ year: y });
                  setLevel('model');
                }}
                style={{
                  height: 46,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: draft.year === y ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: draft.year === y ? colors.primary : colors.border,
                }}>
                <AppText variant="bodyStrong" color={draft.year === y ? '#fff' : colors.text}>
                  {y}
                </AppText>
              </Pressable>
            ))}
          </Grid>
          <CustomEntry
            placeholder="Otro año (ej. 1998)"
            numeric
            value={custom}
            onChange={setCustom}
            onSubmit={() => {
              const y = parseIntInput(custom);
              if (!y || y < 1950 || y > maxCatalogYear()) return toast('Año inválido', 'error');
              set({ year: y });
              setLevel('model');
            }}
          />
        </Animated.View>
      ) : null}

      {level === 'model' ? (
        <Animated.View entering={FadeInRight.duration(200)} style={{ gap: spacing.sm }}>
          <AppText variant="heading">¿Qué modelo?</AppText>
          {models.length > 10 ? <TextField value={query} onChangeText={setQuery} placeholder="Buscar modelo" icon="magnify" /> : null}
          <View style={{ gap: 6 }}>
            {filteredModels.map((m) => (
              <OptionRow
                key={m.id}
                icon={BODY_ICON[m.body] ?? 'car'}
                label={m.name}
                sub={`${variantsFor(m, draft.year).length} versiones`}
                selected={draft.modelId === m.id}
                onPress={() => {
                  set({ modelId: m.id, model: m.name, variant: null, engineId: null });
                  setLevel('variant');
                }}
              />
            ))}
          </View>
          <CustomEntry
            placeholder={models.length ? 'Otro modelo' : 'Escribí el modelo'}
            value={custom}
            onChange={setCustom}
            onSubmit={() => {
              set({ modelId: null, model: custom.trim(), variant: null, engineId: null });
              setLevel('variant');
            }}
          />
        </Animated.View>
      ) : null}

      {level === 'variant' ? (
        <Animated.View entering={FadeInRight.duration(200)} style={{ gap: spacing.sm }}>
          <AppText variant="heading">¿Qué versión?</AppText>
          <View style={{ gap: 6 }}>
            {variants.map((v) => {
              const engine = getEngine(draft.brandId, v.engineId);
              return (
                <OptionRow
                  key={v.name}
                  icon="engine"
                  label={v.name}
                  sub={[engine?.name, v.transmission ? TRANSMISSION[v.transmission] : null].filter(Boolean).join(' · ')}
                  selected={draft.variant === v.name}
                  onPress={() => {
                    set({ variant: v.name, engineId: v.engineId ?? null, fuel: engine?.fuel ?? draft.fuel });
                    setLevel('color');
                  }}
                />
              );
            })}
          </View>
          <CustomEntry
            placeholder="Otra versión"
            value={custom}
            onChange={setCustom}
            onSubmit={() => {
              set({ variant: custom.trim(), engineId: null });
              setLevel('color');
            }}
          />
          <Button label="No sé / omitir" variant="ghost" onPress={() => setLevel('color')} />
        </Animated.View>
      ) : null}

      {level === 'color' ? (
        <Animated.View entering={FadeInRight.duration(200)} style={{ gap: spacing.sm }}>
          <AppText variant="heading">¿De qué color?</AppText>
          <Grid columns={4}>
            {VEHICLE_COLORS.map((c) => {
              const active = draft.color === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => {
                    set({ color: c.name, colorHex: c.hex });
                    setLevel('done');
                  }}
                  style={{ alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: c.hex,
                      borderWidth: active ? 3 : 1,
                      borderColor: active ? colors.primary : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {active ? <Icon name="check" size={24} color={isLightColor(c.hex) ? '#111' : '#fff'} /> : null}
                  </View>
                  <AppText variant="caption" tone="muted" style={{ fontSize: 12 }} numberOfLines={1}>
                    {c.name}
                  </AppText>
                </Pressable>
              );
            })}
          </Grid>
          <CustomEntry
            placeholder="Otro color"
            value={custom}
            onChange={setCustom}
            onSubmit={() => {
              set({ color: custom.trim(), colorHex: colorHexFor(custom) });
              setLevel('done');
            }}
          />
        </Animated.View>
      ) : null}

      {level === 'done' ? (
        <Animated.View entering={FadeIn.duration(220)}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: draft.colorHex ?? colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="car" size={24} color={draft.colorHex && isLightColor(draft.colorHex) ? '#1D2633' : '#fff'} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="overline" tone="primary">
                  {draft.brand} {draft.year ? `· ${draft.year}` : ''}
                </AppText>
                <AppText variant="heading">{draft.model || 'Modelo'}</AppText>
                <AppText variant="caption" tone="muted">
                  {[draft.variant, draft.color].filter(Boolean).join(' · ') || 'Sin versión'}
                </AppText>
              </View>
              <Pressable onPress={() => setLevel('brand')} hitSlop={8}>
                <AppText variant="captionStrong" tone="primary">
                  Cambiar
                </AppText>
              </Pressable>
            </View>
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

const BODY_ICON: Record<string, string> = {
  hatchback: 'car-hatchback',
  sedan: 'car-side',
  suv: 'car-estate',
  pickup: 'car-pickup',
  van: 'van-utility',
  minivan: 'van-passenger',
  coupe: 'car-sports',
  wagon: 'car-estate',
  convertible: 'car-convertible',
};

const TRANSMISSION: Record<string, string> = {
  manual: 'Manual',
  automatica: 'Automática',
  cvt: 'CVT',
  dsg: 'DSG',
};

function Tile({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 64,
        borderRadius: radius.lg,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <AppText variant="subheading" color={selected ? '#fff' : colors.text} style={{ letterSpacing: 0.3 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function OptionRow({ icon, label, sub, selected, onPress }: { icon: string; label: string; sub?: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderRadius: radius.md,
        backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      })}>
      <Icon name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {sub ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-right" size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

function CustomEntry({ placeholder, value, onChange, onSubmit, numeric }: { placeholder: string; value: string; onChange: (v: string) => void; onSubmit: () => void; numeric?: boolean }) {
  return (
    <TextField
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      icon="pencil"
      keyboardType={numeric ? 'number-pad' : 'default'}
      returnKeyType="done"
      onSubmitEditing={() => value.trim() && onSubmit()}
      right={value.trim() ? <Button label="OK" size="sm" onPress={onSubmit} /> : undefined}
    />
  );
}

/* ================================ Step 2 ================================ */

function RegistrationStep({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const vin = normalizeVin(draft.vin);
  const vinInfo = useMemo(() => {
    if (!vin) return null;
    if (vin.length !== 17 || !isValidVin(vin)) return { error: `El VIN tiene 17 caracteres (llevás ${vin.length}).` };
    const brandId = vinBrandId(vin);
    const year = vinModelYear(vin);
    const brandName = getBrand(brandId)?.name;
    const parts = [brandName ? `Fabricante: ${brandName}` : null, year ? `Año modelo: ${year}` : null].filter(Boolean);
    const mismatch = (brandId && draft.brandId && brandId !== draft.brandId) || (year && draft.year && Math.abs(year - draft.year) > 1);
    return { hint: parts.join(' · '), mismatch };
  }, [vin, draft.brandId, draft.year]);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.md }}>
        <TextField
          label="Patente"
          value={draft.plate}
          onChangeText={(t) => set({ plate: t.toUpperCase() })}
          onBlur={() => set({ plate: formatPlate(draft.plate, draft.country) })}
          placeholder="AB 123 CD"
          autoCapitalize="characters"
          icon="card-text-outline"
          maxLength={10}
        />
        <View>
          <FieldLabel label="País de la patente" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {COUNTRIES.slice(0, 10).map((c) => (
              <Chip key={c.code} size="sm" label={`${flagEmoji(c.code)} ${c.name}`} selected={draft.country === c.code} onPress={() => set({ country: c.code })} />
            ))}
          </View>
        </View>
        <TextField
          label="Kilometraje actual"
          hint="Es la base para calcular los próximos services"
          value={draft.odometer}
          onChangeText={(t) => set({ odometer: t })}
          format="int"
          placeholder="0"
          suffix="km"
          icon="speedometer"
        />
        <TextField
          label="N° de chasis / carrocería (VIN)"
          hint="17 caracteres. Figura en la cédula y en el parabrisas."
          value={draft.vin}
          onChangeText={(t) => set({ vin: t })}
          format="upper"
          placeholder="8AP359A1XKU123456"
          autoCapitalize="characters"
          icon="barcode"
          maxLength={20}
          error={vinInfo && 'error' in vinInfo ? vinInfo.error : null}
        />
        {vinInfo && 'hint' in vinInfo && vinInfo.hint ? (
          <AppText variant="caption" tone={vinInfo.mismatch ? 'warning' : 'success'} style={{ marginTop: -8 }}>
            {vinInfo.mismatch ? '⚠ No coincide con lo elegido · ' : '✓ '}
            {vinInfo.hint}
          </AppText>
        ) : null}
        <TextField label="N° de motor" value={draft.engineNumber} onChangeText={(t) => set({ engineNumber: t })} format="upper" autoCapitalize="characters" icon="engine" placeholder="Opcional" />
        <TextField label="Apodo" hint="Opcional, para distinguir tus autos" value={draft.nickname} onChangeText={(t) => set({ nickname: t })} placeholder="Ej. El Cronos" icon="tag-outline" maxLength={30} />
      </View>
    </View>
  );
}

/* ================================ Step 3 ================================ */

function FluidsStep({ draft, set, editing }: { draft: Draft; set: (p: Partial<Draft>) => void; editing: boolean }) {
  const { colors } = useTheme();
  const [researching, setResearching] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  const research = async () => {
    setResearching(true);
    setSource(null);
    try {
      const q = { brand: draft.brand, brandId: draft.brandId, model: draft.model, year: draft.year, variant: draft.variant, engineId: draft.engineId, fuel: draft.fuel };
      let result = fluidsFromCatalog(q);
      if (!result || (!result.oilLiters && !result.coolantLiters)) {
        try {
          const ai = await runAi((p) => p.researchFluids(q));
          if (ai.result) result = { ...(result ?? {}), ...Object.fromEntries(Object.entries(ai.result).filter(([, v]) => v !== undefined)), source: ai.result.source } as typeof result;
        } catch (e) {
          if (!result) throw e;
        }
      }
      if (!result) {
        toast('No encontramos datos confirmados para esta versión. Configurá Gemini en Ajustes para buscar en la web.', 'info');
        return;
      }
      set({
        oilType: result.oilType ?? draft.oilType,
        oilLiters: result.oilLiters ? String(result.oilLiters).replace('.', ',') : draft.oilLiters,
        coolantType: result.coolantType ?? draft.coolantType,
        coolantLiters: result.coolantLiters ? String(result.coolantLiters).replace('.', ',') : draft.coolantLiters,
      });
      const missing = [!result.oilType ? 'aceite' : null, !result.coolantType ? 'refrigerante' : null].filter(Boolean);
      setSource(
        `${result.source}${result.notes ? ` — ${result.notes}` : ''}` +
          (missing.length ? `
Sin datos confirmados de ${missing.join(' ni ')} para esta versión${result.source.startsWith('Gemini') ? '' : ': conectá Gemini en Ajustes › IA para buscarlos en la web'}.` : ''),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo investigar', 'error');
    } finally {
      setResearching(false);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <LinearGradient colors={['#2EE8B6', '#0B63F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="star-four-points" size={22} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Investigar automáticamente</AppText>
            <AppText variant="caption" tone="muted">
              Buscamos tipo y cantidad de aceite y refrigerante para tu {draft.model || 'auto'}.
            </AppText>
          </View>
        </View>
        <Button label={researching ? 'Investigando…' : 'Investigar'} icon="magnify" variant="secondary" loading={researching} onPress={() => void research()} />
        {source ? (
          <AppText variant="caption" tone="muted">
            Fuente: {source}
          </AppText>
        ) : null}
      </Card>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel label="Combustible" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FUELS.map((f) => (
            <Chip key={f.value} size="sm" label={f.label} selected={draft.fuel === f.value} onPress={() => set({ fuel: draft.fuel === f.value ? null : f.value })} />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel label="Aceite de motor" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {OIL_TYPES.map((o) => (
            <Chip key={o} size="sm" label={o} selected={draft.oilType.startsWith(o)} onPress={() => set({ oilType: o })} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 2 }}>
            <TextField value={draft.oilType} onChangeText={(t) => set({ oilType: t })} placeholder="Tipo / norma" icon="oil" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField value={draft.oilLiters} onChangeText={(t) => set({ oilLiters: t.replace(/[^\d,.]/g, '') })} keyboardType="decimal-pad" placeholder="4,0" suffix="L" />
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <FieldLabel label="Refrigerante" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {COOLANT_TYPES.map((o) => (
            <Chip key={o} size="sm" label={o} selected={draft.coolantType === o} onPress={() => set({ coolantType: o })} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 2 }}>
            <TextField value={draft.coolantType} onChangeText={(t) => set({ coolantType: t })} placeholder="Tipo / color" icon="coolant-temperature" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField value={draft.coolantLiters} onChangeText={(t) => set({ coolantLiters: t.replace(/[^\d,.]/g, '') })} keyboardType="decimal-pad" placeholder="5,5" suffix="L" />
          </View>
        </View>
      </View>

      {!editing ? (
        <Card style={{ gap: spacing.md, borderWidth: 1, borderColor: draft.withLastOil ? colors.primary : colors.border }}>
          <Pressable onPress={() => set({ withLastOil: !draft.withLastOil })} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Icon name={draft.withLastOil ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Cargar el último cambio de aceite</AppText>
              <AppText variant="caption" tone="muted">
                Así Careful agenda el próximo service desde hoy.
              </AppText>
            </View>
          </Pressable>
          {draft.withLastOil ? (
            <View style={{ gap: spacing.sm }}>
              <DateField label="Fecha" value={draft.lastOilDate} onChange={(d) => set({ lastOilDate: d })} />
              <TextField label="Kilometraje en ese momento" value={draft.lastOilKm} onChangeText={(t) => set({ lastOilKm: t })} format="int" suffix="km" placeholder={draft.odometer || '0'} />
            </View>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}
