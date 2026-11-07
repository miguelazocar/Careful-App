import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideInUp, SlideOutDown, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/stores/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

import { AppText, Icon } from './primitives';

/** Animated bottom sheet. */
export function Sheet({ visible, onClose, children, title }: { visible: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  // mount immediately when opened; unmount after the exit animation (SheetUnmounter)
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!mounted) return null;
  return (
    <Modal transparent visible={mounted} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent animationType="none">
      {visible ? (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlay }}>
            <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(180)}
            exiting={SlideOutDown.duration(180)}
            onLayout={() => undefined}
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: '88%',
            }}>
            <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md }} />
            {title ? (
              <AppText variant="heading" style={{ marginBottom: spacing.md }}>
                {title}
              </AppText>
            ) : null}
            {children}
          </Animated.View>
        </View>
      ) : (
        <SheetUnmounter onDone={() => setMounted(false)} />
      )}
    </Modal>
  );
}

function SheetUnmounter({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 200);
    return () => clearTimeout(t);
  }, [onDone]);
  return null;
}

/** Global toast host — rendered once at the root. */
export function ToastHost() {
  const { message, tone, key, hide } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2600);
    return () => clearTimeout(t);
  }, [message, key, hide]);

  if (!message) return null;
  const bg = tone === 'error' ? colors.danger : tone === 'info' ? colors.surfaceRaised : '#0E1A2E';
  const icon = tone === 'error' ? 'alert-circle' : tone === 'info' ? 'information-outline' : 'check-circle';
  const iconColor = tone === 'error' ? '#fff' : tone === 'info' ? colors.primary : '#2EE8B6';
  return (
    <Animated.View
      key={key}
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutUp.duration(160)}
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
