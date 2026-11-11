import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { create } from 'zustand';

import { authenticateWithDevice, getDeviceAuthSupport, getPinLength, verifyPin } from '@/services/security';
import { useSettings } from '@/stores/settings';

import { PinPad } from './LockScreen';
import { Sheet } from './ui/overlays';
import { AppText } from './ui/primitives';

interface AuthPromptState {
  visible: boolean;
  reason: string;
  resolve: ((ok: boolean) => void) | null;
}

const useAuthPrompt = create<AuthPromptState>(() => ({ visible: false, reason: '', resolve: null }));

/**
 * Asks for the app's active security (PIN de App or the phone's unlock) before changing data that
 * was already saved. Resolves true right away when no security is enabled.
 */
export async function confirmIdentity(reason = 'Confirmá que sos vos para continuar.'): Promise<boolean> {
  const mode = useSettings.getState().securityMode;
  if (mode === 'none') return true;
  if (mode === 'device') {
    if (await authenticateWithDevice(reason)) return true;
    // the phone's screen lock was removed: the check can't succeed (nor protect anything)
    return !(await getDeviceAuthSupport()).available;
  }
  if ((await getPinLength()) === null) return true; // PIN lost: app-init self-heals the mode
  useAuthPrompt.getState().resolve?.(false);
  return new Promise((resolve) => useAuthPrompt.setState({ visible: true, reason, resolve }));
}

/** Renders the PIN sheet for confirmIdentity(). Mounted once at the root. */
export function AuthPromptHost() {
  const { visible, reason, resolve } = useAuthPrompt();
  const [length, setLength] = useState<number | null>(null);
  const [error, setError] = useState(0);

  useEffect(() => {
    if (visible) void getPinLength().then(setLength);
  }, [visible]);

  const close = (ok: boolean) => {
    resolve?.(ok);
    useAuthPrompt.setState({ visible: false, resolve: null });
  };

  return (
    <Sheet visible={visible} onClose={() => close(false)} title="Ingresá tu PIN">
      <View style={{ alignItems: 'center', gap: 16, paddingBottom: 8 }}>
        <AppText variant="body" tone="muted" align="center">
          {reason}
        </AppText>
        {length ? (
          <PinPad
            length={length}
            error={error}
            onComplete={async (pin) => {
              if (await verifyPin(pin)) close(true);
              else setError((e) => e + 1);
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
