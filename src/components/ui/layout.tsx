import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { spacing, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/theme/tokens';

import { AppText, IconButton } from './primitives';

export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + TAB_BAR_MARGIN * 2 + insets.bottom + 8;
}

export function Header({
  title,
  subtitle,
  back,
  right,
  large,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  large?: boolean;
  onBack?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: spacing.sm }}>
      {(back || right) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          {back ? (
            <IconButton icon="arrow-left" accessibilityLabel="Volver" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
          ) : (
            <View />
          )}
          {!large && title ? (
            <AppText variant="subheading" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: spacing.sm }}>
              {title}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.xs, minWidth: 44, justifyContent: 'flex-end' }}>{right}</View>
        </View>
      )}
      {large && title ? (
        <View>
          <AppText variant="title">{title}</AppText>
          {subtitle ? (
            <AppText variant="body" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function Screen({
  children,
  header,
  scroll = true,
  tabBar = false,
  footer,
  contentStyle,
  scrollProps,
}: {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  tabBar?: boolean;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const bottom = tabBar ? tabSpace : footer ? spacing.md : insets.bottom + spacing.lg;
  const body = scroll ? (
    // Android 16 is edge-to-edge only: the window no longer resizes for the keyboard, so the
    // scroll view itself keeps the focused input above it.
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={footer ? 96 : 24}
      {...scrollProps}
      contentContainerStyle={[{ paddingHorizontal: spacing.lg, paddingBottom: bottom, gap: spacing.lg }, contentStyle]}>
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[{ flex: 1, paddingBottom: tabBar ? tabSpace : 0 }, contentStyle]}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {header}
        {body}
        {footer ? (
          <KeyboardStickyView offset={{ opened: insets.bottom }}>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: insets.bottom + spacing.sm,
              backgroundColor: colors.bg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            {footer}
          </View>
          </KeyboardStickyView>
        ) : null}
      </View>
    </View>
  );
}
