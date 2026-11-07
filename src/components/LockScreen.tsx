import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authenticateWithDevice, getDeviceAuthSupport, getPinLength, verifyPin } from '@/services/security';
import { useSettings } from '@/stores/settings';
import { useLock } from '@/stores/ui';
import { brand, radius, spacing } from '@/theme/tokens';

import { Wordmark } from './brand';
import { AppText, Icon } from './ui/primitives';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'] as const;

export function PinPad({
  length,
  onComplete,
  error,
  onBiometric,
  biometricIcon,
  dark,
}: {
  length: number;
  onComplete: (pin: string) => void;
  error?: number;
  onBiometric?: () => void;
  biometricIcon?: string;
  dark?: boolean;
}) {
  const [pin, setPin] = useState('');
  const shake = useSharedValue(0);
  const fg = dark ? '#FFFFFF' : undefined;

  const [prevError, setPrevError] = useState(error);
  if (error !== prevError) {
    setPrevError(error);
    setPin('');
  }

  useEffect(() => {
    if (!error) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shake.value = withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-8, { duration: 50 }), withTiming(0, { duration: 50 }));
  }, [error, shake]);

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'bio') return onBiometric?.();
    void Haptics.selectionAsync();
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    setPin((p) => {
      const next = (p + k).slice(0, length);
      if (next.length === length) setTimeout(() => onComplete(next), 80);
      return next;
    });
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing.xl }}>
      <Animated.View style={[{ flexDirection: 'row', gap: 16 }, dotsStyle]}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: dark ? 'rgba(255,255,255,0.7)' : brand.blue,
              backgroundColor: i < pin.length ? (dark ? brand.mint : brand.blue) : 'transparent',
            }}
          />
        ))}
      </Animated.View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 288, gap: 18, justifyContent: 'center' }}>
        {KEYS.map((k) => {
          if (k === 'bio' && !onBiometric) return <View key={k} style={{ width: 76, height: 76 }} />;
          return (
            <Pressable
              key={k}
              onPress={() => press(k)}
              accessibilityLabel={k === 'del' ? 'Borrar' : k === 'bio' ? 'Usar biometría' : k}
              style={({ pressed }) => ({
                width: 76,
                height: 76,
                borderRadius: 38,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: k === 'bio' || k === 'del' ? 'transparent' : pressed ? 'rgba(255,255,255,0.28)' : dark ? 'rgba(255,255,255,0.12)' : 'rgba(11,99,246,0.08)',
              })}>
              {k === 'del' ? (
                <Icon name="backspace-outline" size={26} color={fg} />
              ) : k === 'bio' ? (
                <Icon name={biometricIcon ?? 'fingerprint'} size={32} color={dark ? brand.mint : brand.blue} />
              ) : (
                <AppText variant="title" color={fg}>
                  {k}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Full-screen lock. Spec: "Se bloquea al salir; al entrar pide desbloqueo directo sin alertas
 * previas" — the device prompt opens immediately, without an intermediate dialog.
 */
export function LockScreen() {
  const mode = useSettings((s) => s.securityMode);
  const unlock = useLock((s) => s.unlock);
  const insets = useSafeAreaInsets();
  const [pinLength, setPinLength] = useState<number | null>(null);
  const [error, setError] = useState(0);
  const [bioIcon, setBioIcon] = useState('fingerprint');
  const prompting = useRef(false);

  const tryDevice = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticateWithDevice()) unlock();
    } finally {
      prompting.current = false;
    }
  }, [unlock]);

  useEffect(() => {
    if (mode === 'pin') void getPinLength().then(setPinLength);
    if (mode === 'device') {
      void getDeviceAuthSupport().then((s) => setBioIcon(s.label.includes('facial') ? 'face-recognition' : s.biometric ? 'fingerprint' : 'lock'));
      void tryDevice();
    }
  }, [mode, tryDevice]);

  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 999 }}>
      <LinearGradient colors={['#0B1B3F', '#0547C9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.lg }}>
            <Wordmark height={30} variant="light" />
          </View>
          <AppText variant="body" color="rgba(255,255,255,0.8)">
            {mode === 'pin' ? 'Ingresá tu PIN' : 'Desbloqueá para continuar'}
          </AppText>
        </View>
        {mode === 'pin' && pinLength ? (
          <PinPad
            dark
            length={pinLength}
            error={error}
            onComplete={async (pin) => {
              if (await verifyPin(pin)) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                unlock();
              } else setError((e) => e + 1);
            }}
          />
        ) : mode === 'device' ? (
          <Pressable onPress={tryDevice} style={{ alignItems: 'center', gap: spacing.md }} accessibilityLabel="Desbloquear">
            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={bioIcon} size={56} color={brand.mint} />
            </View>
            <AppText variant="bodyStrong" color="#FFFFFF">
              Tocá para desbloquear
            </AppText>
          </Pressable>
        ) : (
          <View />
        )}
        <View />
      </LinearGradient>
    </View>
  );
}
