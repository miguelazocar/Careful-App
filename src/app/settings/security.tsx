import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { PinPad } from '@/components/LockScreen';
import { Sheet } from '@/components/ui/overlays';
import { Header, Screen } from '@/components/ui/layout';
import { AppText, Card, Icon, ListRow, Segmented } from '@/components/ui/primitives';
import { authenticateWithDevice, clearPin, getDeviceAuthSupport, setPin, type DeviceAuthSupport } from '@/services/security';
import { useSettings, type SecurityMode } from '@/stores/settings';
import { toast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function SecurityScreen() {
  const { colors } = useTheme();
  const mode = useSettings((s) => s.securityMode);
  const [support, setSupport] = useState<DeviceAuthSupport | null>(null);
  const [pinStep, setPinStep] = useState<null | { first?: string }>(null);
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [error, setError] = useState(0);

  useEffect(() => {
    void getDeviceAuthSupport().then(setSupport);
  }, []);

  const choose = async (next: SecurityMode) => {
    if (next === mode) return;
    if (next === 'none') {
      await clearPin();
      await useSettings.getState().set('securityMode', 'none');
      toast('Bloqueo desactivado');
    } else if (next === 'device') {
      if (!support?.available) return toast('Configurá un bloqueo de pantalla en el teléfono primero', 'error');
      if (await authenticateWithDevice('Confirmá para activar el bloqueo')) {
        await clearPin();
        await useSettings.getState().set('securityMode', 'device');
        toast(`Bloqueo activado: ${support.label}`);
      }
    } else {
      setPinStep({});
    }
  };

  return (
    <Screen header={<Header back title="Seguridad" />}>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield-lock" size={40} color={colors.primary} />
        </View>
        <AppText variant="body" tone="muted" align="center">
          Careful se bloquea al salir de la app y pide desbloqueo directo al volver. Tu información sigue visible en la vista de apps recientes.
        </AppText>
      </View>
      <Card padded={false}>
        <ListRow icon="lock-open-variant" title="Sin bloqueo" onPress={() => void choose('none')} right={mode === 'none' ? <Icon name="check-circle" size={22} color={colors.primary} /> : <View />} />
        <ListRow
          icon="fingerprint"
          title="Desbloqueo del teléfono"
          subtitle={support ? (support.available ? `${support.label} o PIN/patrón del equipo` : 'El teléfono no tiene bloqueo configurado') : ' '}
          onPress={() => void choose('device')}
          right={mode === 'device' ? <Icon name="check-circle" size={22} color={colors.primary} /> : <View />}
        />
        <ListRow icon="dialpad" title="PIN de App" subtitle="Un código propio de 4 o 6 dígitos" onPress={() => void choose('pin')} right={mode === 'pin' ? <Icon name="check-circle" size={22} color={colors.primary} /> : <View />} last />
      </Card>
      {mode === 'pin' ? (
        <Card padded={false}>
          <ListRow icon="key-variant" title="Cambiar PIN" onPress={() => setPinStep({})} last />
        </Card>
      ) : null}

      <Sheet visible={!!pinStep} onClose={() => setPinStep(null)} title={pinStep?.first ? 'Repetí el PIN' : 'Elegí un PIN'}>
        {pinStep ? (
          <View style={{ gap: spacing.lg, alignItems: 'center' }}>
            {!pinStep.first ? (
              <View style={{ alignSelf: 'stretch' }}>
                <Segmented<'4' | '6'> value={String(pinLength) as '4' | '6'} onChange={(v) => setPinLength(Number(v) as 4 | 6)} options={[{ value: '4', label: '4 dígitos' }, { value: '6', label: '6 dígitos' }]} />
              </View>
            ) : null}
            <PinPad
              key={`${pinStep.first ?? 'first'}-${pinLength}`}
              length={pinLength}
              error={error}
              onComplete={async (pin) => {
                if (!pinStep.first) return setPinStep({ first: pin });
                if (pin !== pinStep.first) {
                  setError((e) => e + 1);
                  toast('Los PIN no coinciden', 'error');
                  return setPinStep({});
                }
                await setPin(pin);
                await useSettings.getState().set('securityMode', 'pin');
                setPinStep(null);
                toast('PIN configurado');
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
