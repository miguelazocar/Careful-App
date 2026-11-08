import { requireOptionalNativeModule } from 'expo';

export interface AuthorizeOptions {
  scopes: string[];
  /** Email of the account to use; omit to let Google choose or ask. */
  account?: string | null;
  /** false = never show UI (background work); rejects with ERR_CONSENT_REQUIRED instead. */
  interactive?: boolean;
  /** Force the account chooser. */
  selectAccount?: boolean;
}

export interface AuthorizeResult {
  accessToken: string;
  grantedScopes: string[];
  email: string | null;
}

/** Error codes thrown by the native module (`error.code`). */
export type GoogleAuthErrorCode =
  | 'ERR_CANCELED'
  | 'ERR_CONSENT_REQUIRED'
  | 'ERR_DEVELOPER'
  | 'ERR_NETWORK'
  | 'ERR_IN_PROGRESS'
  | 'ERR_LAUNCH'
  | 'ERR_AUTH';

interface CarefulGoogleAuthModule {
  authorize(options: AuthorizeOptions): Promise<AuthorizeResult>;
  clearToken(token: string): Promise<void>;
  revokeAccess(account: string, scopes: string[]): Promise<void>;
}

/** Null outside Android dev/release builds (Expo Go, web, tests). */
export const GoogleAuth = requireOptionalNativeModule<CarefulGoogleAuthModule>('CarefulGoogleAuth');
