import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useSettings } from '@/stores/settings';
import { useLock } from '@/stores/ui';

import { palettes, type Palette, type ThemeName } from './tokens';

interface ThemeValue {
  name: ThemeName;
  colors: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({
  name: 'light',
  colors: palettes.light,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSettings((s) => s.theme);
  const system = useColorScheme();

  useEffect(() => {
    // Keep native UI (date pickers, alerts, keyboard) in sync with the in-app choice.
    // On Android this recreates the Activity (briefly "background"): don't let that trigger the lock.
    useLock.getState().beginExternal();
    Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
    setTimeout(() => useLock.getState().endExternal(), 1500);
  }, [preference]);

  const name: ThemeName = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value: ThemeValue = { name, colors: palettes[name], isDark: name === 'dark' };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
