import { t } from "@nimchat/i18n";
import { CircleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, space } from "@/theme/tokens";
import { type } from "@/theme/typography";
import { Button } from "./button";

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={[type.heading, styles.center]}>{title}</Text>
      {!!description && <Text style={[type.body, styles.muted, styles.center]}>{description}</Text>}
    </View>
  );
}

export function ErrorBanner({
  message,
  actionLabel = t("Try again"),
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <View style={styles.row}>
        <CircleAlert size={16} color={colors.danger} />
        <Text style={[type.label, styles.bannerText]}>{message}</Text>
      </View>
      {onAction && <Button label={actionLabel} variant="danger" onPress={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xl },
  center: { textAlign: "center" },
  muted: { color: colors.textMuted },
  banner: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger + "44",
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bannerText: { color: colors.danger, flex: 1 },
});
