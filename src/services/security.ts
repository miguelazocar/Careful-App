import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { withExternalActivity } from '@/stores/ui';

const PIN_KEY = 'careful.pin.v1';

interface StoredPin {
  salt: string;
  hash: string;
  length: number;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  // Salted, iterated SHA-256. PINs are short, so the iteration count adds brute-force cost.
  let h = `${salt}:${pin}`;
  for (let i = 0; i < 200; i++) {
    h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h);
  }
  return h;
}

export async function setPin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const value: StoredPin = { salt, hash: await hashPin(pin, salt), length: pin.length };
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify(value));
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

export async function getPinLength(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as StoredPin).length;
  } catch {
    return null;
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) return false;
  const stored = JSON.parse(raw) as StoredPin;
  return (await hashPin(pin, stored.salt)) === stored.hash;
}

export interface DeviceAuthSupport {
  available: boolean;
  biometric: boolean;
  label: string;
}

export async function getDeviceAuthSupport(): Promise<DeviceAuthSupport> {
  const [hasHardware, enrolled, level, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const biometric = hasHardware && enrolled;
  const available = level !== LocalAuthentication.SecurityLevel.NONE;
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const label = biometric ? (finger ? 'Huella digital' : face ? 'Reconocimiento facial' : 'Biometría') : 'Bloqueo de pantalla del teléfono';
  return { available, biometric, label };
}

/** Prompts biometrics, falling back to the device PIN/pattern. */
export async function authenticateWithDevice(prompt = 'Desbloquear Careful'): Promise<boolean> {
  const result = await withExternalActivity(() =>
    LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
      requireConfirmation: false,
    }),
  );
  return result.success;
}
