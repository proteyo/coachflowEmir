import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Flame } from "lucide-react-native";
import React, { ReactNode, useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  PressableProps,
  RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";

type AppTextVariant =
  | "display"
  | "title"
  | "h2"
  | "h3"
  | "body"
  | "bodyStrong"
  | "small"
  | "caption";

type ScreenEdge = "top" | "bottom" | "left" | "right";

export function ScreenContainer({
  children,
  scroll,
  refreshControl,
  padded = true,
  edges,
  contentTopPadding = 50,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  padded?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  contentTopPadding?: number;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  /*
    ВАЖНО:
    По умолчанию НЕ добавляем "top" в SafeAreaView.

    Страницы внутри Tabs/Stack уже имеют native header.
    Если добавить top через SafeAreaView, экран может сначала открыться без отступа,
    а потом сдвинуться вниз после расчёта safe-area.

    Поэтому красивый верхний отступ делаем обычным paddingTop.
    Он фиксированный и появляется сразу, без прыжка.
  */
  const safeEdges = edges ?? ["left", "right"];

  const horizontalPadding = padded ? theme.spacing.lg : 0;
  const bottomScrollPadding = Math.max(132, insets.bottom + 112);

  if (scroll) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg,
        }}
        edges={safeEdges}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={{
              flex: 1,
              backgroundColor: theme.colors.bg,
            }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: contentTopPadding,
              paddingHorizontal: horizontalPadding,
              paddingBottom: bottomScrollPadding,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            scrollIndicatorInsets={{
              top: 0,
              bottom: Math.max(32, insets.bottom + 24),
              left: 0,
              right: 0,
            }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg,
      }}
      edges={safeEdges}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={{
            flex: 1,
            paddingTop: contentTopPadding,
            paddingHorizontal: horizontalPadding,
          }}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function AppText({
  variant = "body",
  color,
  style,
  children,
  ...rest
}: TextProps & { variant?: AppTextVariant; color?: string }) {
  const { theme } = useTheme();
  const t = theme.typography[variant] ?? theme.typography.body;

  return (
    <Text {...rest} style={[t, { color: color ?? theme.colors.text }, style]}>
      {children}
    </Text>
  );
}

export function AppCard({
  children,
  style,
  padded = true,
  variant = "surface",
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  variant?: "surface" | "elevated" | "outline";
}) {
  const { theme } = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: padded ? theme.spacing.lg : 0,
    borderWidth: variant === "outline" ? 1 : 0,
    borderColor: theme.colors.border,
  };

  return (
    <View style={[base, variant === "elevated" ? theme.shadows.card : undefined, style]}>
      {children}
    </View>
  );
}

export function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  style,
  fullWidth,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}) {
  const { theme } = useTheme();
  const heights = { sm: 38, md: 48, lg: 56 } as const;
  const isDisabled = disabled || loading;

  const palette = useMemo(() => {
    if (variant === "primary") {
      return {
        bg: theme.colors.primary,
        fg: theme.colors.primaryContrast,
        border: "transparent",
      };
    }

    if (variant === "danger") {
      return {
        bg: theme.colors.danger,
        fg: "#fff",
        border: "transparent",
      };
    }

    if (variant === "dark") {
      return {
        bg: theme.mode === "dark" ? "#0B1525" : "#0B1A2E",
        fg: "#fff",
        border: "transparent",
      };
    }

    if (variant === "ghost") {
      return {
        bg: "transparent",
        fg: theme.colors.text,
        border: "transparent",
      };
    }

    return {
      bg: theme.colors.surfaceAlt,
      fg: theme.colors.text,
      border: theme.colors.border,
    };
  }, [variant, theme]);

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          height: heights[size],
          borderRadius: theme.radius.lg,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 18,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: palette.border,
          alignSelf: fullWidth ? "stretch" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon}

          <Text
            style={{
              color: palette.fg,
              fontSize: size === "lg" ? 16 : 15,
              fontWeight: "700" as TextStyle["fontWeight"],
              letterSpacing: 0.2,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function AppInput({
  label,
  error,
  style,
  containerStyle,
  leftIcon,
  rightIcon,
  ...rest
}: TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <AppText
          variant="caption"
          color={theme.colors.textMuted}
          style={{ textTransform: "uppercase" }}
        >
          {label}
        </AppText>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.radius.md,
          paddingHorizontal: 14,
          minHeight: 50,
          borderWidth: 1,
          borderColor: error ? theme.colors.danger : "transparent",
        }}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}

        <TextInput
          placeholderTextColor={theme.colors.textFaint}
          style={[
            {
              flex: 1,
              color: theme.colors.text,
              fontSize: 15,
              fontWeight: "500" as TextStyle["fontWeight"],
              paddingVertical: Platform.OS === "android" ? 8 : 0,
            },
            style,
          ]}
          {...rest}
        />

        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <AppText variant="small" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function AppAvatar({
  uri,
  name,
  size = 44,
  ring,
}: {
  uri?: string;
  name?: string;
  size?: number;
  ring?: boolean;
}) {
  const { theme } = useTheme();

  const initials = (name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: ring ? 2 : 0,
        borderColor: theme.colors.primary,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: size / 2.6 }}>
          {initials}
        </Text>
      )}
    </View>
  );
}

export function AppChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: theme.radius.pill,
        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon}

      <Text
        style={{
          color: active ? theme.colors.primaryContrast : theme.colors.text,
          fontWeight: "600",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "primary" | "fire" | "warn";
}) {
  const { theme } = useTheme();

  const bg =
    tone === "primary"
      ? theme.colors.primary
      : tone === "fire"
        ? theme.colors.fire
        : tone === "warn"
          ? theme.colors.warn
          : theme.colors.surface;

  const fg = tone === "default" ? theme.colors.text : "#fff";
  const sub = tone === "default" ? theme.colors.textMuted : "rgba(255,255,255,0.85)";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        gap: 6,
        borderWidth: tone === "default" ? 1 : 0,
        borderColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 12,
            color: sub,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {label}
        </Text>

        {icon}
      </View>

      <Text style={{ fontSize: 26, color: fg, fontWeight: "800", letterSpacing: -0.4 }}>
        {value}
      </Text>

      {hint ? <Text style={{ fontSize: 12, color: sub, fontWeight: "500" }}>{hint}</Text> : null}
    </View>
  );
}

export function StreakPill({ count }: { count: number }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,122,26,0.15)",
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: theme.radius.pill,
        gap: 4,
      }}
    >
      <Flame size={14} color={theme.colors.fire} fill={theme.colors.fire} />
      <Text style={{ color: theme.colors.fire, fontWeight: "800", fontSize: 13 }}>{count}</Text>
    </View>
  );
}

export function AppEmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ alignItems: "center", padding: theme.spacing.xl, gap: 8 }}>
      {icon}

      <AppText variant="h3">{title}</AppText>

      {message ? (
        <AppText variant="small" color={theme.colors.textMuted} style={{ textAlign: "center" }}>
          {message}
        </AppText>
      ) : null}

      {action}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  icon,
}: {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginVertical: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon}

        <AppText variant="h2">{title}</AppText>
      </View>

      {action}
    </View>
  );
}

export function GradientHeader({
  children,
  height = 220,
  colors,
}: {
  children?: ReactNode;
  height?: number;
  colors?: readonly [string, string, ...string[]];
}) {
  const { theme } = useTheme();
  const c = colors ?? (theme.gradients.hero as readonly [string, string]);

  return (
    <LinearGradient
      colors={c}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: 12,
      }}
    >
      {children}
    </LinearGradient>
  );
}

export function PressableScale(props: PressableProps & { children: ReactNode }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        typeof props.style === "function"
          ? props.style({ pressed, hovered: false })
          : props.style,
        {
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    />
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
});

export function Divider({ vertical }: { vertical?: boolean }) {
  const { theme } = useTheme();

  return (
    <View
      style={
        vertical
          ? { width: 1, alignSelf: "stretch", backgroundColor: theme.colors.borderSoft }
          : { height: 1, alignSelf: "stretch", backgroundColor: theme.colors.borderSoft }
      }
    />
  );
}

export function TabBarPill({
  options,
  active,
  onChange,
}: {
  options: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        backgroundColor: theme.colors.surfaceAlt,
        padding: 4,
        borderRadius: theme.radius.lg,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const isActive = active === o.key;

        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => ({
              paddingVertical: 9,
              paddingHorizontal: 14,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: isActive ? theme.colors.surface : "transparent",
              opacity: pressed ? 0.82 : 1,
              flexGrow: 0,
              flexShrink: 0,
            })}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: isActive ? theme.colors.text : theme.colors.textMuted,
                fontWeight: "700",
                fontSize: 13,
                includeFontPadding: false,
                textAlign: "center",
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}