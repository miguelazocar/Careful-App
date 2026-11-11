import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { TextField } from '@/components/ui/inputs';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Button, Card, ListRow, SwitchRow } from '@/components/ui/primitives';
import { formatInt, parseIntInput } from '@/lib/format';
import { ensurePermission, getPermissionStatus, syncNotifications } from '@/services/notifications';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { spacing } from '@/theme/tokens';

export default function NotificationsScreen() {
  const prefs = useSettings((s) => s.notifications);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('granted');
  const [warn, setWarn] = useState(formatInt(prefs.warnKm));
  const [iosPicker, setIosPicker] = useState(false);

  useEffect(() => {
    void getPermissionStatus().then(setPermission);
  }, []);

  const patch = async (p: Partial<typeof prefs>) => {
    await useSettings.getState().patch('notifications', p);
    void syncNotifications();
  };

  const pickTime = () => {
    const value = new Date();
    value.setHours(prefs.hour, prefs.minute, 0, 0);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onChange: (e, d) => e.type === 'set' && d && void patch({ hour: d.getHours(), minute: d.getMinutes() }),
      });
    } else setIosPicker((v) => !v);
  };

  const time = `${String(prefs.hour).padStart(2, '0')}:${String(prefs.minute).padStart(2, '0')} h`;

  return (
    <Screen header={<Header back title="Notificaciones" />}>
      {permission !== 'granted' ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="bodyStrong">Las notificaciones están bloqueadas</AppText>
          <AppText variant="caption" tone="muted">
            Sin permiso no podemos avisarte de los próximos services.
          </AppText>
          <Button
            label={permission === 'denied' ? 'Abrir ajustes del teléfono' : 'Permitir notificaciones'}
            variant="secondary"
            onPress={async () => {
              if (permission === 'denied') return void Linking.openSettings();
              const ok = await ensurePermission();
              setPermission(ok ? 'granted' : 'denied');
              if (ok) void syncNotifications();
            }}
          />
        </Card>
      ) : null}

      <Card padded={false}>
        <ListRow icon="clock-outline" title="Hora del aviso" subtitle="Los avisos de service están siempre activos" value={time} onPress={pickTime} last />
      </Card>
      {iosPicker && Platform.OS === 'ios' ? (
        <DateTimePicker value={new Date(2000, 0, 1, prefs.hour, prefs.minute)} mode="time" display="spinner" onChange={(_, d) => d && void patch({ hour: d.getHours(), minute: d.getMinutes() })} />
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Cuándo avisarte
        </AppText>
        <Card padded={false}>
          <SwitchRow title="Al comenzar el mes" subtitle="El día 1 del mes del service" value={prefs.month} onChange={(v) => void patch({ month: v })} />
          <SwitchRow title="Al comenzar la semana" subtitle="El lunes de esa semana" value={prefs.week} onChange={(v) => void patch({ week: v })} />
          <SwitchRow title="Un día antes" value={prefs.dayBefore} onChange={(v) => void patch({ dayBefore: v })} />
          <SwitchRow title="El mismo día" value={prefs.sameDay} onChange={(v) => void patch({ sameDay: v })} last />
        </Card>
        <AppText variant="caption" tone="subtle">
          Si dos avisos caen el mismo día, enviamos solo uno (el más específico).
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" tone="muted">
          Kilometraje
        </AppText>
        <Card padded={false}>
          <SwitchRow icon="speedometer" title="Aviso por kilometraje" subtitle="Cuando falten pocos km para el service" value={prefs.kmAlert} onChange={(v) => void patch({ kmAlert: v })} />
          <SwitchRow
            icon="counter"
            title="Recordarme actualizar el km"
            subtitle="Si pasan 30 días sin cargarlo"
            value={prefs.odometerNudgeDays > 0}
            onChange={(v) => void patch({ odometerNudgeDays: v ? 30 : 0 })}
            last
          />
        </Card>
        <TextField
          label="Avisar cuando falten menos de"
          value={warn}
          onChangeText={setWarn}
          format="int"
          suffix="km"
          onBlur={() => {
            const n = parseIntInput(warn);
            if (!n || n < 100 || n > 10000) {
              setWarn(formatInt(prefs.warnKm));
              return toast('Elegí un valor entre 100 y 10.000 km', 'info');
            }
            void patch({ warnKm: n });
          }}
        />
      </View>
    </Screen>
  );
}
