import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { create } from 'zustand';

import { PhotoStrip, VehicleSelector } from '@/components/pickers';
import { FieldLabel, TextField } from '@/components/ui/inputs';
import { Sheet } from '@/components/ui/overlays';
import { AppText, Button, Icon } from '@/components/ui/primitives';
import { normalizeText } from '@/data/catalog';
import { createRecord, getOdometerReadings, getRecord, updateRecord, type RecordInput } from '@/db/records';
import type { Vehicle } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { ACCESSORY_CATEGORY, ACCESSORY_ICONS, isOtherItem } from '@/domain/maintenance';
import { currentOdometer, odometerError, validateOdometer } from '@/domain/schedule';
import { today } from '@/lib/dates';
import { formatAmount, formatInt, formatKm, parseAmountInput, parseIntInput } from '@/lib/format';
import { ensurePermission } from '@/services/notifications';
import { deletePhotoFiles } from '@/services/photos';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * Quick modals for the two light records:
 *  - Accesorio: título, descripción, monto, km y foto.
 *  - Kilometraje: km actual y descripción, nada más.
 * Opened from anywhere with `openQuickRecord`; `QuickRecordHost` lives in the root layout.
 */
export type QuickKind = 'accessory' | 'odometer';

export interface QuickRequest {
  kind: QuickKind;
  vehicleId?: string;
  /** Edit an existing record. */
  recordId?: string;
  /** Prefilled title (accessory), e.g. from "registrar como hecho". */
  title?: string;
}

const useQuickRecord = create<{ req: (QuickRequest & { seq: number }) | null }>(() => ({ req: null }));
let seq = 0;

export function openQuickRecord(req: QuickRequest): void {
  useQuickRecord.setState({ req: { ...req, seq: ++seq } });
}

export function QuickRecordHost() {
  const req = useQuickRecord((s) => s.req);
  // keep the last request mounted while the sheet glides out
  const [shown, setShown] = useState(req);
  if (req && req !== shown) setShown(req);
  if (!shown) return null;
  return <QuickRecordSheet key={shown.seq} req={shown} visible={req === shown} onClose={() => useQuickRecord.setState({ req: null })} />;
}

/** Accessory suggestions (tap to fill the title). */
const SUGGESTIONS = ACCESSORY_CATEGORY.items.filter((i) => !isOtherItem(i.key));

function QuickRecordSheet({ req, visible, onClose }: { req: QuickRequest; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const accessory = req.kind === 'accessory';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(req.vehicleId ?? null);
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState(req.title ?? '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [odometer, setOdometer] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [readings, setReadings] = useState<{ date: string; km: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const original = useRef<{ photos: string[]; km: number | null }>({ photos: [], km: null });
  const sessionPhotos = useRef<string[]>([]);
  const saved = useRef(false);

  useEffect(() => {
    void (async () => {
      const list = await listVehicles();
      setVehicles(list);
      if (req.recordId) {
        const r = await getRecord(req.recordId);
        if (!r) return;
        setVehicleId(r.vehicleId);
        setDate(r.date);
        setTitle(r.items[0]?.label ?? '');
        setDescription(r.description ?? '');
        setAmount(r.amountCents !== null ? formatAmount(r.amountCents) : '');
        setOdometer(r.odometer !== null ? formatInt(r.odometer) : '');
        setPhotos(r.photos.map((p) => p.path));
        original.current = { photos: r.photos.map((p) => p.path), km: r.odometer };
      } else if (!req.vehicleId) {
        const last = useSettings.getState().lastVehicleId;
        setVehicleId((list.some((v) => v.id === last) ? last : null) ?? list[0]?.id ?? null);
      }
    })();
  }, [req]);

  useEffect(() => {
    if (!vehicleId) return;
    void getOdometerReadings(vehicleId).then(setReadings);
  }, [vehicleId]);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const lastKm = vehicle ? currentOdometer(vehicle.initialOdometer, readings) : null;
  const km = parseIntInput(odometer);

  const close = () => {
    // photos taken here and never saved
    if (!saved.current) deletePhotoFiles(sessionPhotos.current);
    onClose();
  };

  const persist = async () => {
    if (!vehicleId) return;
    setSaving(true);
    try {
      const name = title.trim();
      const match = SUGGESTIONS.find((i) => normalizeText(i.label) === normalizeText(name));
      const input: RecordInput = {
        vehicleId,
        kind: req.kind,
        date,
        odometer: km,
        amountCents: accessory ? parseAmountInput(amount) : null,
        workshop: null,
        description: description.trim() || null,
        items: accessory ? [{ category: ACCESSORY_CATEGORY.key, item: match?.key ?? `${ACCESSORY_CATEGORY.key}.otro`, label: match?.label ?? name }] : [],
        photos: accessory ? photos : [],
      };
      if (req.recordId) {
        const { removedPhotos } = await updateRecord(req.recordId, input);
        deletePhotoFiles(removedPhotos);
      } else {
        await createRecord(input);
      }
      saved.current = true;
      deletePhotoFiles(sessionPhotos.current.filter((p) => !photos.includes(p)));
      await useSettings.getState().set('lastVehicleId', vehicleId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(accessory ? (req.recordId ? 'Accesorio actualizado' : 'Accesorio registrado') : 'Kilometraje actualizado');
      if (!accessory) void ensurePermission();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!vehicleId) return toast('Elegí un vehículo', 'info');
    if (accessory && !title.trim()) return toast('Escribí qué accesorio pusiste', 'info');
    if (km === null) return toast('Ingresá el kilometraje actual', 'info');
    const impossible = odometerError(km);
    if (impossible) return toast(impossible, 'error');
    const problem = validateOdometer(km, date, readings, vehicle?.initialOdometer ?? 0, req.recordId ? original.current.km : undefined);
    if (problem) {
      Alert.alert('Revisá el kilometraje', `${formatKm(km)}: ${problem}\n\n¿Guardar igual?`, [
        { text: 'Corregir', style: 'cancel' },
        { text: 'Guardar igual', onPress: () => void persist() },
      ]);
      return;
    }
    void persist();
  };

  const kmField = (
    <TextField
      label="Kilometraje actual"
      value={odometer}
      onChangeText={setOdometer}
      format="int"
      suffix="km"
      icon="speedometer"
      placeholder={lastKm ? formatInt(lastKm) : '0'}
      autoFocus={!accessory && !req.recordId}
    />
  );

  return (
    <Sheet visible={visible} onClose={close} title={accessory ? (req.recordId ? 'Editar accesorio' : 'Nuevo accesorio') : 'Actualizar kilometraje'}>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xs }}>
        {vehicles.length > 1 && !req.recordId ? <VehicleSelector vehicles={vehicles} value={vehicleId} onChange={setVehicleId} /> : null}

        {accessory ? (
          <>
            <View style={{ gap: spacing.xs }}>
              <TextField label="¿Qué pusiste?" value={title} onChangeText={setTitle} placeholder="Ej. Polarizado, estéreo, alarma…" icon="star-four-points" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
                {SUGGESTIONS.map((s) => {
                  const active = normalizeText(s.label) === normalizeText(title);
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => setTitle(s.label)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        height: 32,
                        paddingHorizontal: 10,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primarySoft : colors.surface,
                      }}>
                      <Icon name={ACCESSORY_ICONS[s.key] ?? 'star-four-points'} size={15} color={active ? colors.primary : colors.textMuted} />
                      <AppText variant="caption" color={active ? colors.primary : colors.text}>
                        {s.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <TextField label="Descripción" value={description} onChangeText={setDescription} multiline placeholder="Marca, modelo, dónde lo instalaste…" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Monto" value={amount} onChangeText={setAmount} format="amount" placeholder="0" icon="cash" />
              </View>
              <View style={{ flex: 1 }}>{kmField}</View>
            </View>
            <View>
              <FieldLabel label="Foto" hint="Opcional" />
              <PhotoStrip
                photos={photos}
                max={4}
                onChange={(next) => {
                  next.filter((p) => !photos.includes(p) && !original.current.photos.includes(p)).forEach((p) => sessionPhotos.current.push(p));
                  setPhotos(next);
                }}
              />
            </View>
          </>
        ) : (
          <>
            {kmField}
            <AppText variant="caption" tone="muted" style={{ marginTop: -spacing.xs }}>
              Último registrado: {formatKm(lastKm)}
            </AppText>
            <TextField label="Descripción" value={description} onChangeText={setDescription} placeholder="Opcional, ej. viaje a la costa" icon="text" />
          </>
        )}

        <Button label="Guardar" icon="check" size="lg" full loading={saving} onPress={save} />
      </ScrollView>
    </Sheet>
  );
}
