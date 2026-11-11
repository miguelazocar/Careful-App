import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthPromptHost } from '@/components/AuthPrompt';
import { LockScreen } from '@/components/LockScreen';
import { ToastHost } from '@/components/ui/overlays';
import { AppText, Button } from '@/components/ui/primitives';
import { bootstrap } from '@/services/app-init';
import { useSettings } from '@/stores/settings';
import { useLock } from '@/stores/ui';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap()
      .then(() => setReady(true))
      .catch((e: unknown) => setBootError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if ((ready && fontsLoaded) || bootError) void SplashScreen.hideAsync();
  }, [ready, fontsLoaded, bootError]);

  if (bootError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <AppText variant="heading">No se pudo iniciar Careful</AppText>
        <AppText tone="muted" align="center">
          {bootError}
        </AppText>
        <Button label="Reintentar" onPress={() => {
          setBootError(null);
          bootstrap().then(() => setReady(true)).catch((e: unknown) => setBootError(String(e)));
        }} />
      </View>
    );
  }
  if (!ready || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { colors, isDark } = useTheme();
  const locked = useLock((s) => s.locked);
  const securityMode = useSettings((s) => s.securityMode);

  // Lock when the app goes to background (spec), except while a system screen we opened is in front.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      const { externalActivity, lock } = useLock.getState();
      if (externalActivity === 0 && useSettings.getState().securityMode !== 'none') lock();
    });
    return () => sub.remove();
  }, []);

  // Tapping a reminder notification opens the agenda.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response) return;
    const data = response.notification.request.content.data as { vehicleId?: string } | undefined;
    if (data?.vehicleId) router.push('/calendar');
  }, [response]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavThemeProvider value={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="vehicle/form" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="record/form" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="reminder/form" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style={locked ? 'light' : isDark ? 'light' : 'dark'} />
        <ToastHost />
        <AuthPromptHost />
        {locked && securityMode !== 'none' ? <LockScreen /> : null}
      </View>
    </NavThemeProvider>
  );
}
