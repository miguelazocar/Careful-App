import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { IntervalFields } from '@/components/IntervalFields';
import { FieldLabel, TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Icon, ListRow, Segmented } from '@/components/ui/primitives';
import { BrandSheet, ColorSheet, OptionSheet, SelectField } from '@/components/vehicle-fields';
import { getBrand, getModel, matchBrand, maxCatalogYear, modelsFor, variantsFor, yearsForBrand } from '@/data/catalog';
import { createRecord, getOdometerReadings } from '@/db/records';
import { getServiceRules, saveServiceRule } from '@/db/reminders';
import { createVehicle, getVehicle, updateVehicle, type VehicleInput } from '@/db/vehicles';
import { colorHexFor } from '@/domain/colors';
import { COUNTRIES, flagEmoji } from '@/domain/countries';
import { describeMissing, mergeFluids, missingFluidFields } from '@/domain/fluids';
import { formatPlate, normalizePlate } from '@/domain/plate';
import { CORE_ITEM, findItem } from '@/domain/maintenance';
import { currentOdometer, odometerError, resolveInterval } from '@/domain/schedule';
import { COOLANT_BASES, COOLANT_CONCENTRATIONS, coolantMix, FUEL_OPTIONS, fuelLabel, OIL_BASES, type CoolantBase, type FuelKey, type OilBase } from '@/domain/vehicle-specs';
import { isValidVin, normalizeVin, vinBrandId, vinModelYear } from '@/domain/vin';
import { today } from '@/lib/dates';
import { formatInt, parseIntInput } from '@/lib/format';
import { fluidsFromCatalog, primaryProvider, runAi, type FluidSuggestion, type VehicleGuess } from '@/services/ai';
import { ensurePermission } from '@/services/notifications';
import { deletePhotoFiles, pickPhoto, photoUri } from '@/services/photos';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

interface Draft {
  photo: string | null;
  brandId: string | null;
  brand: string;
  modelId: string | null;
  model: string;
  variant: string | null;
  engineId: string | null;
  year: number | null;
  color: string | null;
  colorHex: string | null;
  plate: string;
  country: string;
  odometer: string;
  vin: string;
  engineNumber: string;
  fuel: string | null;
  oilBase: string | null;
  oilLiters: string;
  oilBrand: string;
  oilModel: string;
  oilType: string;
  /** Base oil-change interval (the vehicle's plan); every service can still set its own. */
  oilIntervalKm: string;
  oilIntervalMonths: number;
  coolantBase: string | null;
  coolantLiters: string;
  coolantConcentration: number | null;
  coolantBrand: string;
  coolantModel: string;
  coolantType: string;
  /** "Otro modelo": model and version typed by hand instead of picked from the catalog. */
  manualModel: boolean;
  /** Not editable anymore; kept so editing doesn't erase it. */
  nickname: string | null;
  notes: string | null;
}

const EMPTY: Draft = {
  photo: null,
  brandId: null,
  brand: '',
  modelId: null,
  model: '',
  variant: null,
  engineId: null,
  year: null,
  color: null,
  colorHex: null,
  plate: '',
  country: 'AR',
  odometer: '',
  vin: '',
  engineNumber: '',
  fuel: null,
  oilBase: null,
  oilLiters: '',
  oilBrand: '',
  oilModel: '',
  oilType: '',
  oilIntervalKm: formatInt(findItem(CORE_ITEM)?.item.intervalKm ?? 10000),
  oilIntervalMonths: findItem(CORE_ITEM)?.item.intervalMonths ?? 12,
  coolantBase: null,
  coolantLiters: '',
  coolantConcentration: null,
  coolantBrand: '',
  coolantModel: '',
  coolantType: '',
  manualModel: false,
  nickname: null,
  notes: null,
};

const STEPS = ['Auto', 'Registro', 'Aceite', 'Refrigerante'];
const LAST = STEPS.length - 1;

const decimal = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};
const litersText = (n: number | null | undefined) => (n ? String(n).replace('.', ',') : '');
const liters = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} L`;
const clean = (s: string) => s.trim() || null;

export default function VehicleFormScreen() {
  const params = useLocalSearchParams<{ id?: string; step?: string }>();
  const id = params.id;
  const editing = !!id;
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(() => Math.min(LAST, Math.max(0, Number(params.step) || 0)));
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [initialPhoto, setInitialPhoto] = useState<string | null>(null);
  /** When editing: odometer at creation and the current one (latest reading). */
  const [km, setKm] = useState<{ initial: number; current: number } | null>(null);
  const [researching, setResearching] = useState(false);
  const [source, setSource] = useState<ResearchInfo | null>(null);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!id) return;
    void Promise.all([getVehicle(id), getOdometerReadings(id), getServiceRules(id)]).then(([v, readings, rules]) => {
      if (!v) return;
      const oilPlan = resolveInterval(CORE_ITEM, rules);
      const current = currentOdometer(v.initialOdometer, readings);
      setKm({ initial: v.initialOdometer, current });
      setInitialPhoto(v.photo);
      setDraft({
        photo: v.photo,
        brandId: v.brandId,
        brand: v.brand,
        modelId: v.modelId,
        model: v.model,
        variant: v.variant,
        engineId: v.engineId,
        year: v.year,
        color: v.color,
        colorHex: v.colorHex,
        plate: formatPlate(v.plate, v.country),
        country: v.country,
        // "Kilometraje actual" is the latest reading, not the value entered when the car was added
        odometer: formatInt(current),
        vin: v.vin ?? '',
        engineNumber: v.engineNumber ?? '',
        fuel: v.fuel,
        oilBase: v.oilBase,
        oilLiters: litersText(v.oilLiters),
        oilBrand: v.oilBrand ?? '',
        oilModel: v.oilModel ?? '',
        oilType: v.oilType ?? '',
        oilIntervalKm: oilPlan.intervalKm ? formatInt(oilPlan.intervalKm) : '',
        oilIntervalMonths: oilPlan.intervalMonths ?? 0,
        coolantBase: v.coolantBase,
        coolantLiters: litersText(v.coolantLiters),
        coolantConcentration: v.coolantConcentration,
        coolantBrand: v.coolantBrand ?? '',
        coolantModel: v.coolantModel ?? '',
        coolantType: v.coolantType ?? '',
        // a model that isn't in the catalog was typed by hand
        manualModel: !!v.model && !getModel(v.brandId, v.modelId),
        nickname: v.nickname,
        notes: v.notes,
      });
      setLoaded(true);
    });
  }, [id]);

  const applyGuess = (g: VehicleGuess) =>
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
        next.engineId = null;
        const v = getModel(next.brandId, next.modelId)?.variants.find((x) => x.name === g.variant);
        if (v) next.fuel = v.fuel;
      }
      next.manualModel = !!next.model && !getModel(next.brandId, next.modelId);
      if (g.color) {
        next.color = g.color;
        next.colorHex = colorHexFor(g.color);
      }
      return next;
    });

  /** "Investigar con IA": the manufacturer's fluids for this exact year, engine and version (catalog first, then Gemini with web search). */
  const research = async () => {
    setResearching(true);
    setSource(null);
    try {
      const q = { brand: draft.brand, brandId: draft.brandId, model: draft.model, year: draft.year, variant: draft.variant, engineId: draft.engineId, fuel: draft.fuel };
      const catalog = fluidsFromCatalog(q);
      const cloud = primaryProvider().id === 'gemini';
      let fromAi: FluidSuggestion | null = null;
      let aiProblem: string | null = null;
      if (cloud) {
        try {
          const ai = await runAi((p) => p.researchFluids(q));
          if (ai.provider.id === 'gemini') fromAi = ai.result;
          else aiProblem = 'sin conexión, no se pudo consultar Gemini';
        } catch (e) {
          aiProblem = e instanceof Error ? e.message : String(e);
        }
      }
      const r = mergeFluids(catalog, fromAi);
      if (!r) {
        toast(
          aiProblem
            ? `No se pudo investigar: ${aiProblem}`
            : cloud
              ? 'Gemini no encontró datos confiables para esta versión. Completalos desde el manual.'
              : 'Para investigar con IA, cargá tu clave gratuita de Gemini en Ajustes › Inteligencia artificial.',
          aiProblem ? 'error' : 'info',
        );
        return;
      }
      // technical values are replaced; the preferred product (brand/model) only fills empty fields
      setDraft((d) => ({
        ...d,
        oilType: r.oilType ?? d.oilType,
        oilLiters: r.oilLiters ? litersText(r.oilLiters) : d.oilLiters,
        oilBase: r.oilBase ?? d.oilBase,
        oilBrand: d.oilBrand || r.oilBrand || '',
        oilModel: d.oilModel || r.oilModel || '',
        coolantType: r.coolantType ?? d.coolantType,
        coolantLiters: r.coolantLiters ? litersText(r.coolantLiters) : d.coolantLiters,
        coolantBase: r.coolantBase ?? d.coolantBase,
        coolantConcentration: r.coolantConcentration ?? d.coolantConcentration,
        coolantBrand: d.coolantBrand || r.coolantBrand || '',
        coolantModel: d.coolantModel || r.coolantModel || '',
        oilIntervalKm: r.oilIntervalKm ? formatInt(r.oilIntervalKm) : d.oilIntervalKm,
        oilIntervalMonths: r.oilIntervalMonths ?? d.oilIntervalMonths,
      }));
      const missing = missingFluidFields(r);
      const gap = missing.length
        ? aiProblem
          ? ` Falta ${describeMissing(missing)}: ${aiProblem}`
          : cloud
            ? ` No se encontró ${describeMissing(missing)}: completalo desde el manual.`
            : ` Falta ${describeMissing(missing)}: conectá Gemini en Ajustes › Inteligencia artificial para buscarlo.`
        : '';
      setSource({ text: `${r.source}${r.engine ? ` · motor ${r.engine}` : ''}${r.notes ? ` — ${r.notes}` : ''}.${gap}`, sources: r.sources ?? [] });
      toast('Datos completados con IA. Revisalos antes de guardar.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo investigar', 'error');
    } finally {
      setResearching(false);
    }
  };

  const validAuto = !!draft.brand.trim() && !!draft.model.trim();
  const odometer = parseIntInput(draft.odometer);
  const validRegistro = odometer !== null;

  const canEnter = (i: number) => editing || i <= step || (i === step + 1 && (step !== 0 || validAuto) && (step !== 1 || validRegistro));

  const next = () => {
    if (step === 0 && !validAuto) return toast('Elegí al menos la marca y el modelo', 'info');
    if (step === 1 && !validRegistro) return toast('Ingresá el kilometraje actual', 'info');
    if (step === 1 && odometer !== null && odometerError(odometer)) return toast(odometerError(odometer)!, 'error');
    setStep((s) => s + 1);
  };

  const save = async () => {
    if (!validAuto) {
      setStep(0);
      return toast('Elegí al menos la marca y el modelo', 'info');
    }
    if (odometer === null) {
      setStep(1);
      return toast('Ingresá el kilometraje actual', 'info');
    }
    if (odometerError(odometer)) {
      setStep(1);
      return toast(odometerError(odometer)!, 'error');
    }
    // Editing the current km: a higher value is a new reading of today; with no readings yet it
    // simply corrects the starting km; never lower than what was already logged.
    let initialOdometer = odometer;
    let newReading: number | null = null;
    if (editing && km) {
      initialOdometer = km.initial;
      if (odometer !== km.current) {
        if (km.current === km.initial) initialOdometer = odometer;
        else if (odometer > km.current) newReading = odometer;
        else {
          setStep(1);
          return toast(`El kilometraje no puede ser menor al último registrado (${formatInt(km.current)} km).`, 'error');
        }
      }
    }
    setSaving(true);
    try {
      const input: VehicleInput = {
        nickname: draft.nickname,
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
        initialOdometer,
        oilBase: draft.oilBase,
        oilBrand: clean(draft.oilBrand),
        oilModel: clean(draft.oilModel),
        oilType: clean(draft.oilType),
        oilLiters: decimal(draft.oilLiters),
        coolantBase: draft.coolantBase,
        coolantBrand: clean(draft.coolantBrand),
        coolantModel: clean(draft.coolantModel),
        coolantType: clean(draft.coolantType),
        coolantLiters: decimal(draft.coolantLiters),
        coolantConcentration: draft.coolantConcentration,
        notes: draft.notes,
      };
      const saveOilPlan = (vehicleId: string) =>
        saveServiceRule({ vehicleId, item: CORE_ITEM, intervalKm: parseIntInput(draft.oilIntervalKm), intervalMonths: draft.oilIntervalMonths || null, enabled: true });
      if (editing && id) {
        await updateVehicle(id, input);
        await saveOilPlan(id);
        if (newReading !== null) {
          await createRecord({ vehicleId: id, kind: 'odometer', date: today(), odometer: newReading, amountCents: null, workshop: null, description: null, items: [], photos: [] });
        }
        if (initialPhoto && initialPhoto !== draft.photo) deletePhotoFiles([initialPhoto]);
        toast('Vehículo actualizado');
        router.back();
      } else {
        const v = await createVehicle(input);
        await saveOilPlan(v.id);
        await useSettings.getState().set('lastVehicleId', v.id);
        void ensurePermission();
        toast('¡Vehículo agregado!');
        router.replace({ pathname: '/vehicle/[id]', params: { id: v.id } });
      }
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
          <Header back title={editing ? 'Editar vehículo' : 'Nuevo vehículo'} onBack={() => (step > 0 && !editing ? setStep(step - 1) : router.back())} />
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            {STEPS.map((s, i) => (
              <Pressable key={s} style={{ flex: 1, gap: 4 }} onPress={() => (canEnter(i) ? setStep(i) : undefined)} accessibilityRole="tab" accessibilityState={{ selected: i === step }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step || editing ? (i === step ? colors.primary : colors.primary + '66') : colors.border }} />
                <AppText variant="caption" tone={i === step ? 'primary' : 'subtle'} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 12 }}>
                  {i + 1}. {s}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      }
      footer={
        editing ? (
          <Button label="Guardar cambios" icon="check" size="lg" full loading={saving} onPress={() => void save()} />
        ) : step < LAST ? (
          <Button label="Continuar" icon="arrow-right" size="lg" full onPress={next} disabled={step === 0 ? !validAuto : step === 1 ? !validRegistro : false} />
        ) : (
          <Button label="Guardar vehículo" icon="check" size="lg" full loading={saving} onPress={() => void save()} />
        )
      }>
      {step === 0 ? (
        <AutoStep draft={draft} set={set} onGuess={applyGuess} />
      ) : step === 1 ? (
        <RegistroStep draft={draft} set={set} />
      ) : step === 2 ? (
        <AceiteStep draft={draft} set={set} researching={researching} source={source} onResearch={() => void research()} />
      ) : (
        <RefrigeranteStep draft={draft} set={set} researching={researching} source={source} onResearch={() => void research()} />
      )}
    </Screen>
  );
}

type StepProps = { draft: Draft; set: (p: Partial<Draft>) => void };

/* ============================== 1. Auto ============================== */

type AutoSheet = null | 'photo' | 'brand' | 'year' | 'model' | 'variant' | 'color';
/** Brand and year first: they decide which models and versions exist. */
const AUTO_ORDER: AutoSheet[] = ['brand', 'year', 'model', 'variant', 'color'];

/** The model (and version) are typed by hand only for "Otro modelo" or a brand outside the catalog. */
const isManual = (d: Draft) => d.manualModel || (!!d.brand && !getBrand(d.brandId));

function AutoStep({ draft, set, onGuess }: StepProps & { onGuess: (g: VehicleGuess) => void }) {
  const { colors } = useTheme();
  const [sheet, setSheet] = useState<AutoSheet>(null);
  const [busy, setBusy] = useState<null | 'card' | 'photo'>(null);

  const brand = getBrand(draft.brandId);
  const model = getModel(draft.brandId, draft.modelId);
  const manual = isManual(draft);
  const models = useMemo(() => (brand ? modelsFor(brand.id, draft.year) : []), [brand, draft.year]);
  const variants = useMemo(() => (model ? variantsFor(model, draft.year) : []), [model, draft.year]);
  const years = useMemo(() => {
    if (brand) return yearsForBrand(brand.id);
    const max = maxCatalogYear();
    return Array.from({ length: max - 1979 }, (_, i) => max - i);
  }, [brand]);

  /** After a choice, open the next empty field so the flow feels like one gesture. */
  const advance = (from: AutoSheet, d: Partial<Draft>) => {
    const merged = { ...draft, ...d };
    const empty = (k: AutoSheet) => (k === 'brand' ? !merged.brand : k === 'year' ? !merged.year : k === 'model' ? !merged.model : k === 'variant' ? !merged.variant : !merged.color);
    const next = AUTO_ORDER.slice(AUTO_ORDER.indexOf(from) + 1).find(empty) ?? null;
    // typed by hand: stop the chain so the user can write the model
    setSheet(isManual(merged) && (next === 'model' || next === 'variant') ? null : next);
  };

  const choosePhoto = async (src: 'camera' | 'library') => {
    setSheet(null);
    try {
      const p = await pickPhoto(src, { edit: true, aspect: [4, 3] });
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
      if (!Object.values(result).filter(Boolean).length) return toast('No pudimos leer la cédula. Probá con más luz y sin reflejos.', 'info');
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
    if (!uri) return setSheet('photo');
    try {
      setBusy('photo');
      const { result } = await runAi((ai) => ai.analyzeVehiclePhoto(uri));
      const { brand: b, brandId, model: m, modelId, ...rest } = result;
      // from a photo we only trust plate & color, and brand/model when nothing was chosen yet
      onGuess({ ...rest, ...(draft.brand ? {} : { brand: b, brandId, model: m, modelId }) });
      toast(result.plate || result.color ? 'Detectamos datos en la foto. Revisalos.' : 'No se detectó la patente ni el color.', result.plate || result.color ? 'success' : 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo analizar la foto', 'error');
    } finally {
      setBusy(null);
    }
  };

  const uri = photoUri(draft.photo);
  const listLink = (
    <Pressable onPress={() => set({ manualModel: false, modelId: null, model: '', variant: null })} hitSlop={8}>
      <AppText variant="captionStrong" tone="primary">
        Elegir de la lista
      </AppText>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, height: 112 }}>
        <Pressable onPress={() => setSheet('photo')} accessibilityLabel="Foto del auto" style={{ flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
          {uri ? (
            <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[colors.primarySoft, colors.surface]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="camera-plus" size={28} color={colors.primary} />
              <AppText variant="captionStrong" tone="primary">
                Agregar foto
              </AppText>
            </LinearGradient>
          )}
        </Pressable>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AiButton icon="card-account-details-outline" label="Leer cédula" sub="Completa todo" busy={busy === 'card'} onPress={() => void scanCard()} />
          <AiButton icon="text-recognition" label="Leer foto" sub="Patente y color" busy={busy === 'photo'} onPress={() => void analyzePhoto()} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1.7 }}>
          <SelectField
            label="Marca"
            value={draft.brand}
            placeholder="Elegí la marca"
            left={draft.brand ? <BrandLogo brandId={draft.brandId} brand={draft.brand} size={28} /> : <Icon name="car-info" size={20} color={colors.textSubtle} />}
            onPress={() => setSheet('brand')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectField label="Año" value={draft.year ? String(draft.year) : null} placeholder="Año" onPress={() => setSheet('year')} disabled={!draft.brand} />
        </View>
      </View>

      {manual ? (
        <>
          <TextField
            label="Modelo"
            labelRight={brand ? listLink : undefined}
            value={draft.model}
            onChangeText={(t) => set({ model: t, modelId: null })}
            placeholder="Escribí el modelo"
            icon="pencil"
          />
          <TextField label="Variante / versión" value={draft.variant ?? ''} onChangeText={(t) => set({ variant: t })} placeholder="Ej. 1.6 Highline" icon="pencil" />
        </>
      ) : (
        <>
          <SelectField
            label="Modelo"
            value={draft.model}
            placeholder={!draft.brand ? 'Primero la marca' : !draft.year ? 'Primero el año' : 'Elegí el modelo'}
            onPress={() => setSheet('model')}
            disabled={!draft.brand || !draft.year}
          />
          <SelectField label="Variante / versión" value={draft.variant} placeholder={model ? 'Elegí la versión' : 'Primero el modelo'} onPress={() => setSheet('variant')} disabled={!model} />
        </>
      )}

      <SelectField
        label="Color"
        value={draft.color}
        placeholder="Elegí el color"
        left={draft.color ? <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: draft.colorHex ?? colors.textSubtle, borderWidth: 1, borderColor: colors.border }} /> : undefined}
        onPress={() => setSheet('color')}
      />

      <Sheet visible={sheet === 'photo'} onClose={() => setSheet(null)} title="Foto del vehículo">
        <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <ListRow icon="camera" title="Tomar foto" onPress={() => void choosePhoto('camera')} />
          <ListRow icon="image" title="Elegir de la galería" onPress={() => void choosePhoto('library')} last={!draft.photo} />
          {draft.photo ? (
            <ListRow
              icon="delete-outline"
              title="Quitar foto"
              danger
              last
              onPress={() => {
                setSheet(null);
                set({ photo: null });
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <BrandSheet
        visible={sheet === 'brand'}
        selected={draft.brandId}
        onClose={() => setSheet(null)}
        onSelect={(brandId) => {
          const b = getBrand(brandId)!;
          const patch: Partial<Draft> =
            draft.brandId === brandId ? { brandId, brand: b.name } : { brandId, brand: b.name, modelId: null, model: '', variant: null, engineId: null, manualModel: false };
          set(patch);
          advance('brand', patch);
        }}
        onCustom={(name) => {
          const match = matchBrand(name);
          const patch: Partial<Draft> = { brandId: match?.id ?? null, brand: match?.name ?? name, modelId: null, model: '', variant: null, engineId: null, manualModel: !match };
          set(patch);
          advance('brand', patch);
        }}
      />

      <OptionSheet
        visible={sheet === 'year'}
        title={draft.brand ? `Año del ${draft.brand}` : 'Año'}
        placeholder="Buscar el año"
        options={years.map((y) => ({ key: String(y), label: String(y) }))}
        selected={draft.year ? String(draft.year) : null}
        onClose={() => setSheet(null)}
        onSelect={(key) => {
          const y = Number(key);
          const patch: Partial<Draft> = { year: y };
          // keep the chosen model / version only if they existed that year
          if (!manual && brand && model) {
            if (!modelsFor(brand.id, y).some((m) => m.id === model.id)) Object.assign(patch, { modelId: null, model: '', variant: null });
            else if (draft.variant && !variantsFor(model, y).some((v) => v.name === draft.variant)) patch.variant = null;
          }
          set(patch);
          advance('year', patch);
        }}
        onCustom={
          brand
            ? undefined
            : (text) => {
                const y = parseIntInput(text);
                if (!y || y < 1950 || y > maxCatalogYear()) return toast('Año inválido', 'error');
                set({ year: y });
                advance('year', { year: y });
              }
        }
      />

      <OptionSheet
        visible={sheet === 'model'}
        title={`Modelos ${draft.brand}${draft.year ? ` ${draft.year}` : ''}`}
        placeholder="Buscar el modelo"
        options={models.map((m) => ({ key: m.id, label: m.name, sub: `${variantsFor(m, draft.year).length} versiones`, icon: BODY_ICON[m.body] ?? 'car' }))}
        selected={draft.modelId}
        onClose={() => setSheet(null)}
        onSelect={(modelId) => {
          const m = getModel(draft.brandId, modelId)!;
          const patch: Partial<Draft> = { modelId, model: m.name, manualModel: false, ...(draft.modelId === modelId ? {} : { variant: null, engineId: null }) };
          set(patch);
          advance('model', patch);
        }}
        extraOption={{
          label: 'Otro modelo',
          sub: 'No está en la lista: escribilo a mano',
          icon: 'pencil-plus',
          onPress: () => {
            set({ manualModel: true, modelId: null, model: '', variant: null, engineId: null });
            setSheet(null);
          },
        }}
      />

      <OptionSheet
        visible={sheet === 'variant'}
        title={`Versiones ${draft.model}${draft.year ? ` ${draft.year}` : ''}`}
        placeholder="Buscar la versión"
        options={variants.map((v) => ({ key: v.name, label: v.name, sub: [fuelLabel(v.fuel), v.transmission ? TRANSMISSION[v.transmission] : null].filter(Boolean).join(' · '), icon: 'engine' }))}
        selected={draft.variant}
        onClose={() => setSheet(null)}
        onSelect={(name) => {
          const v = variants.find((x) => x.name === name);
          const patch: Partial<Draft> = { variant: name, engineId: null, fuel: v?.fuel ?? draft.fuel };
          set(patch);
          advance('variant', patch);
        }}
      />

      <ColorSheet
        visible={sheet === 'color'}
        selected={draft.color}
        onClose={() => setSheet(null)}
        onSelect={(name, hex) => {
          set({ color: name, colorHex: hex ?? colorHexFor(name) });
          setSheet(null);
        }}
      />
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
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
      })}>
      <LinearGradient colors={['#2EE8B6', '#0B63F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name={icon} size={18} color="#fff" />}
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

const TRANSMISSION: Record<string, string> = { manual: 'Manual', automatica: 'Automática', cvt: 'CVT', dsg: 'DSG' };

/* ============================ 2. Registro ============================ */

function RegistroStep({ draft, set }: StepProps) {
  const [countrySheet, setCountrySheet] = useState(false);
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
  const country = COUNTRIES.find((c) => c.code === draft.country);

  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        label="Patente / placa"
        labelRight={
          <Pressable onPress={() => setCountrySheet(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AppText variant="captionStrong" tone="primary">
              {flagEmoji(draft.country)} {country?.name ?? draft.country}
            </AppText>
            <Icon name="chevron-down" size={16} />
          </Pressable>
        }
        value={draft.plate}
        onChangeText={(t) => set({ plate: t.toUpperCase() })}
        onBlur={() => set({ plate: formatPlate(draft.plate, draft.country) })}
        placeholder="AB 123 CD"
        autoCapitalize="characters"
        icon="card-text-outline"
        maxLength={10}
      />
      <TextField label="Kilometraje actual" value={draft.odometer} onChangeText={(t) => set({ odometer: t })} format="int" placeholder="0" suffix="km" icon="speedometer" />
      <View>
        <TextField
          label="Serial de chasis (VIN)"
          value={draft.vin}
          onChangeText={(t) => set({ vin: t })}
          format="upper"
          placeholder="17 caracteres"
          autoCapitalize="characters"
          icon="barcode"
          maxLength={20}
          error={vinInfo && 'error' in vinInfo ? vinInfo.error : null}
        />
        {vinInfo && 'hint' in vinInfo && vinInfo.hint ? (
          <AppText variant="caption" tone={vinInfo.mismatch ? 'warning' : 'success'} style={{ marginTop: 4 }} numberOfLines={1}>
            {vinInfo.mismatch ? '⚠ No coincide con lo elegido · ' : '✓ '}
            {vinInfo.hint}
          </AppText>
        ) : null}
      </View>
      <TextField label="Serial de motor" value={draft.engineNumber} onChangeText={(t) => set({ engineNumber: t })} format="upper" autoCapitalize="characters" icon="engine" placeholder="Opcional" />
      <View>
        <FieldLabel label="Tipo de combustible" />
        <Segmented<FuelKey> options={FUEL_OPTIONS} value={(draft.fuel ?? '') as FuelKey} onChange={(v) => set({ fuel: v })} />
      </View>

      <OptionSheet
        visible={countrySheet}
        title="País de la patente"
        options={COUNTRIES.map((c) => ({ key: c.code, label: `${flagEmoji(c.code)}  ${c.name}` }))}
        selected={draft.country}
        onClose={() => setCountrySheet(false)}
        onSelect={(code) => {
          set({ country: code, plate: formatPlate(draft.plate, code) });
          setCountrySheet(false);
        }}
      />
    </View>
  );
}

/* ====================== 3. Aceite · 4. Refrigerante ====================== */

interface ResearchInfo {
  text: string;
  sources: { title: string; url: string }[];
}
type FluidStepProps = StepProps & { researching: boolean; source: ResearchInfo | null; onResearch: () => void };

function ResearchBar({ draft, researching, source, onResearch, subject }: Omit<FluidStepProps, 'set'> & { subject: string }) {
  const { colors } = useTheme();
  const vehicle = [draft.model, draft.year].filter(Boolean).join(' ') || 'tu auto';
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={onResearch}
        disabled={researching}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        })}>
        <LinearGradient colors={['#2EE8B6', '#0B63F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
          {researching ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="star-four-points" size={18} color="#fff" />}
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <AppText variant="captionStrong">{researching ? 'Investigando en internet…' : 'Investigar con IA'}</AppText>
          <AppText variant="caption" tone="muted" style={{ fontSize: 11 }} numberOfLines={2}>
            {subject} del fabricante para {vehicle}
          </AppText>
        </View>
        <Icon name="chevron-right" size={20} color={colors.textSubtle} />
      </Pressable>
      {source ? (
        <View style={{ gap: 2 }}>
          <AppText variant="caption" tone="muted" style={{ fontSize: 11 }} numberOfLines={2}>
            {source.text}
          </AppText>
          {source.sources.length ? (
            <AppText variant="caption" tone="muted" style={{ fontSize: 11 }} numberOfLines={1}>
              Fuentes:{' '}
              {source.sources.map((s, i) => (
                <AppText key={s.url} variant="caption" tone="primary" style={{ fontSize: 11 }} onPress={() => void Linking.openURL(s.url)}>
                  {i ? ' · ' : ''}
                  {s.title}
                </AppText>
              ))}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AceiteStep({ draft, set, ...rest }: FluidStepProps) {
  return (
    <View style={{ gap: spacing.md }}>
      <ResearchBar draft={draft} subject="Aceite, cantidad e intervalo" {...rest} />
      <View>
        <FieldLabel label="Tipo de aceite" />
        <Segmented<OilBase> options={OIL_BASES} value={(draft.oilBase ?? '') as OilBase} onChange={(v) => set({ oilBase: v })} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Marca" value={draft.oilBrand} onChangeText={(t) => set({ oilBrand: t })} placeholder="Ej. Shell" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Modelo" value={draft.oilModel} onChangeText={(t) => set({ oilModel: t })} placeholder="Ej. Helix HX8" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1.5 }}>
          <TextField label="Versión" value={draft.oilType} onChangeText={(t) => set({ oilType: t })} placeholder="Ej. 5W-30 · ACEA C2" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Cantidad" value={draft.oilLiters} onChangeText={(t) => set({ oilLiters: t.replace(/[^\d,.]/g, '') })} keyboardType="decimal-pad" placeholder="4,0" suffix="L" />
        </View>
      </View>
      <IntervalFields
        km={draft.oilIntervalKm}
        months={draft.oilIntervalMonths}
        onKm={(t) => set({ oilIntervalKm: t })}
        onMonths={(m) => set({ oilIntervalMonths: m })}
        kmLabel="Cambio cada"
      />
    </View>
  );
}

function RefrigeranteStep({ draft, set, ...rest }: FluidStepProps) {
  const { colors } = useTheme();
  const total = decimal(draft.coolantLiters);
  const mix = coolantMix(total, draft.coolantConcentration);
  return (
    <View style={{ gap: spacing.md }}>
      <ResearchBar draft={draft} subject="Refrigerante, cantidad y mezcla" {...rest} />
      <View>
        <FieldLabel label="Tipo de refrigerante" />
        <Segmented<CoolantBase> options={COOLANT_BASES} value={(draft.coolantBase ?? '') as CoolantBase} onChange={(v) => set({ coolantBase: v })} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField label="Cantidad total" value={draft.coolantLiters} onChangeText={(t) => set({ coolantLiters: t.replace(/[^\d,.]/g, '') })} keyboardType="decimal-pad" placeholder="6,0" suffix="L" />
        </View>
        <View style={{ flex: 1.5 }}>
          <FieldLabel label="Concentración" />
          <Segmented
            options={COOLANT_CONCENTRATIONS.map((p) => ({ value: String(p), label: `${p}%` }))}
            value={draft.coolantConcentration ? String(draft.coolantConcentration) : ''}
            onChange={(v) => set({ coolantConcentration: Number(v) })}
          />
        </View>
      </View>
      <View style={{ gap: 6, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
        {mix ? (
          <>
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: '#9EC5FF' }}>
              <View style={{ width: `${draft.coolantConcentration}%`, backgroundColor: colors.primary }} />
            </View>
            <AppText variant="captionStrong">
              {liters(mix.coolant)} de refrigerante + {liters(mix.water)} de agua desmineralizada
            </AppText>
          </>
        ) : (
          <AppText variant="caption" tone="muted">
            Ingresá la cantidad total y la concentración para calcular cuánto refrigerante y cuánta agua desmineralizada usar.
          </AppText>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Marca" value={draft.coolantBrand} onChangeText={(t) => set({ coolantBrand: t })} placeholder="Ej. Paraflu" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Modelo" value={draft.coolantModel} onChangeText={(t) => set({ coolantModel: t })} placeholder="Ej. Up" />
        </View>
      </View>
      <TextField label="Versión" value={draft.coolantType} onChangeText={(t) => set({ coolantType: t })} placeholder="Norma y color, ej. G12+ · rosa" />
    </View>
  );
}
