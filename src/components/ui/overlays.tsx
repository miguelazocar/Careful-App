import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, SlideInUp, SlideOutUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText, Icon } from './primitives';

const SHEET_IN = { duration: 320, easing: Easing.out(Easing.cubic) };
const SHEET_OUT = { duration: 220, easing: Easing.in(Easing.cubic) };

/**
 * Bottom sheet that glides up and eases to a stop (no spring). Driven by a shared value instead
 * of a layout animation. The modal window doesn't shrink for the keyboard (edge-to-edge), so the
 * sheet is lifted by the keyboard height itself; otherwise a short sheet ends up behind it.
 */
export function Sheet({ visible, onClose, children, title }: { visible: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const progress = useSharedValue(0);
  const keyboard = useReanimatedKeyboardAnimation();

  useEffect(() => {
    if (!mounted) return;
    progress.value = withTiming(visible ? 1 : 0, visible ? SHEET_IN : SHEET_OUT);
    if (visible) return;
    const t = setTimeout(() => setMounted(false), SHEET_OUT.duration + 30);
    return () => clearTimeout(t);
  }, [visible, mounted, progress]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * windowHeight }] }));
  // keyboard.height is negative while the keyboard is open
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -keyboard.height.value) }));

  if (!mounted) return null;
  return (
    <Modal transparent visible={mounted} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent animationType="none">
      <Animated.View style={[{ flex: 1, justifyContent: 'flex-end' }, liftStyle]}>
        <Animated.View style={[{ position: 'absolute', inset: 0, backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} disabled={!visible} accessibilityLabel="Cerrar" />
        </Animated.View>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            {
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: '88%',
            },
            sheetStyle,
          ]}>
          <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md }} />
          {title ? (
            <AppText variant="heading" style={{ marginBottom: spacing.md }}>
              {title}
            </AppText>
          ) : null}
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** How long a toast stays on screen once it has slid in. */
const TOAST_VISIBLE_MS = 3000;
// Smooth glide in and out (no spring, so it never bounces).
const toastEnter = SlideInUp.duration(380).easing(Easing.out(Easing.cubic));
const toastExit = SlideOutUp.duration(300).easing(Easing.in(Easing.cubic));

/** Global toast host — rendered once at the root. */
export function ToastHost() {
  const { message, tone, key, hide } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, TOAST_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [message, key, hide]);

  if (!message) return null;
  const bg = tone === 'error' ? colors.danger : tone === 'info' ? colors.surfaceRaised : '#0E1A2E';
  const icon = tone === 'error' ? 'alert-circle' : tone === 'info' ? 'information-outline' : 'check-circle';
  const iconColor = tone === 'error' ? '#fff' : tone === 'info' ? colors.primary : '#2EE8B6';
  return (
    <Animated.View
      key={key}
      entering={toastEnter}
      exiting={toastExit}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: spacing.lg, right: spacing.lg, zIndex: 1000 }}>
      <Pressable
        onPress={hide}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: bg,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}>
        <Icon name={icon} size={22} color={iconColor} />
        <AppText variant="bodyStrong" color={tone === 'info' ? colors.text : '#FFFFFF'} style={{ flex: 1 }}>
          {message}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
