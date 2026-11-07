import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { VehicleSelector } from '@/components/pickers';
import { DateField, FieldLabel, TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Chip, IconButton } from '@/components/ui/primitives';
import { createManualReminder, deleteManualReminder, getManualReminder, setManualReminderDone, updateManualReminder } from '@/db/reminders';
import type { Vehicle } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { addMonthsTo, today } from '@/lib/dates';
import { formatInt, parseIntInput } from '@/lib/format';
import { ensurePermission } from '@/services/notifications';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const PRESETS = ['VTV', 'Seguro', 'Patente', 'Licencia de conducir', 'Cambio de neumáticos', 'Service oficial'];

export default function ReminderFormScreen() {
  const { id, vehicleId: paramVehicle } = useLocalSearchParams<{ id?: string; vehicleId?: string }>();
  const { colors } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [useDate, setUseDate] = useState(true);
  const [date, setDate] = useState(addMonthsTo(today(), 1));
  const [km, setKm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await listVehicles();
      setVehicles(list);
      if (id) {
        const r = await getManualReminder(id);
        if (r) {
          setVehicleId(r.vehicleId);
          setTitle(r.title);
          setNotes(r.notes ?? '');
          setUseDate(!!r.dueDate);
          if (r.dueDate) setDate(r.dueDate);
          setKm(r.dueOdometer !== null ? formatInt(r.dueOdometer) : '');
        }
      } else {
        setVehicleId(paramVehicle ?? useSettings.getState().lastVehicleId ?? list[0]?.id ?? null);
      }
    })();
  }, [id, paramVehicle]);

  const save = async () => {
    if (!vehicleId) return toast('Elegí un vehículo', 'info');
    if (!title.trim()) return toast('Poné un título', 'info');
    const dueOdometer = parseIntInput(km);
    if (!useDate && dueOdometer === null) return toast('Elegí una fecha o un kilometraje', 'info');
    setSaving(true);
    try {
      const input = { vehicleId, title: title.trim(), notes: notes.trim() || null, dueDate: useDate ? date : null, dueOdometer };
      if (id) await updateManualReminder(id, input);
      else await createManualReminder(input);
      void ensurePermission();
      toast('Recordatorio guardado');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={
        <Header
          back
          title={id ? 'Recordatorio' : 'Nuevo recordatorio'}
          right={
            id ? (
              <IconButton
                icon="delete-outline"
                color={colors.danger}
                accessibilityLabel="Eliminar"
                onPress={() =>
                  Alert.alert('Eliminar recordatorio', '¿Seguro?', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteManualReminder(id);
                        router.back();
                      },
                    },
                  ])
                }
              />
            ) : undefined
          }
        />
      }
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button label="Guardar" icon="check" size="lg" full loading={saving} onPress={() => void save()} />
          {id ? (
            <Button
              label="Marcar como hecho"
              icon="check-circle"
              variant="secondary"
              full
              onPress={async () => {
                await setManualReminderDone(id, true);
                toast('¡Listo! Recordatorio completado');
                router.back();
              }}
            />
          ) : null}
        </View>
      }>
      {vehicles.length > 1 ? (
        <View>
          <FieldLabel label="Vehículo" />
          <VehicleSelector vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
        </View>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <TextField label="¿Qué hay que hacer?" value={title} onChangeText={setTitle} placeholder="Ej. Renovar seguro" icon="bell-ring" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map((p) => (
            <Chip key={p} size="sm" label={p} selected={title === p} onPress={() => setTitle(p)} />
          ))}
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        <FieldLabel label="¿Cuándo?" hint="Por fecha, por kilometraje o ambos (lo que ocurra primero)" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip size="sm" label="Con fecha" icon="calendar-month" selected={useDate} onPress={() => setUseDate(!useDate)} />
        </View>
        {useDate ? <DateField value={date} onChange={setDate} maximumToday={false} /> : null}
        <TextField label="A los (opcional)" value={km} onChangeText={setKm} format="int" suffix="km" placeholder="Ej. 60.000" icon="speedometer" />
      </View>
      <TextField label="Notas" value={notes} onChangeText={setNotes} multiline placeholder="Opcional" />
      <AppText variant="caption" tone="subtle">
        Te avisamos al comenzar el mes, la semana, el día anterior y el mismo día.
      </AppText>
    </Screen>
  );
}
