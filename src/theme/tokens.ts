/**
 * Careful design tokens.
 * Palette derived from the brand identity (docs/brand):
 *  - Brand blue  #0B63F6 → #0547C9 (icon gradient / "Car" in the wordmark)
 *  - Mint accent #2EE8B6 (icon swoosh + checkmarks)
 *  - Ink navy    #1D2633 ("eful" in the wordmark)
 */

export type ThemeName = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  overlay: string;
  shadow: string;
  tabBar: string;
  wordmarkTail: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#F3F6FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EDF1F7',
    surfaceRaised: '#FFFFFF',
    border: '#E1E7F0',
    text: '#141C2B',
    textMuted: '#5F6E85',
    textSubtle: '#94A0B4',
    primary: '#0B63F6',
    primaryStrong: '#0547C9',
    primarySoft: '#E5EEFF',
    onPrimary: '#FFFFFF',
    accent: '#14C895',
    accentSoft: '#DCF7EE',
    danger: '#E8384F',
    dangerSoft: '#FDE7EA',
    warning: '#E8930C',
    warningSoft: '#FDF1DC',
    success: '#13A974',
    successSoft: '#DDF5EB',
    overlay: 'rgba(8, 13, 25, 0.5)',
    shadow: '#0B1B3A',
    tabBar: '#FFFFFF',
    wordmarkTail: '#1D2633',
  },
  dark: {
    bg: '#070B14',
    surface: '#0F1624',
    surfaceAlt: '#161F31',
    surfaceRaised: '#1A2438',
    border: '#1F2A40',
    text: '#F2F5FA',
    textMuted: '#97A3B8',
    textSubtle: '#5D6A80',
    primary: '#3B82FF',
    primaryStrong: '#1F6BFF',
    primarySoft: '#13244A',
    onPrimary: '#FFFFFF',
    accent: '#2EE8B6',
    accentSoft: '#0D3A31',
    danger: '#FF5C70',
    dangerSoft: '#3A1520',
    warning: '#FFB547',
    warningSoft: '#3A2A10',
    success: '#2EE8B6',
    successSoft: '#0D3A31',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
    tabBar: '#121A2A',
    wordmarkTail: '#F2F5FA',
  },
};

export const brand = {
  gradient: ['#2F80FF', '#0547C9'] as const,
  gradientMint: ['#2EE8B6', '#14C895'] as const,
  blue: '#0B63F6',
  mint: '#2EE8B6',
  ink: '#1D2633',
};

export const radius = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, pill: 999 } as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const fonts = {
  display: 'Outfit_700Bold',
  title: 'Outfit_600SemiBold',
  titleMedium: 'Outfit_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Height of the floating tab bar (without safe-area inset). Screens pad their content by this. */
export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_MARGIN = 12;
