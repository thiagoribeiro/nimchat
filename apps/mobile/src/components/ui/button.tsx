import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, space, touch } from "@/theme/tokens";
import { font } from "@/theme/typography";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  label,
  onPress,
  variant = "secondary",
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        off && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" ? colors.primaryText : colors.textSecondary} />
      ) : (
        icon
      )}
      <Text style={[styles.label, variant === "primary" && styles.labelPrimary, variant === "danger" && styles.labelDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger + "55" },
  ghost: { backgroundColor: "transparent" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: font.semibold, fontSize: 14, color: colors.textSecondary },
  labelPrimary: { color: colors.primaryText },
  labelDanger: { color: colors.danger },
});
