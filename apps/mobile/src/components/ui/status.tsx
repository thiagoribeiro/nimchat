import { t } from "@nimchat/i18n";
import { statusInfo } from "@nimchat/brian";
import type { Block, StatusTone } from "@nimchat/brian";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, space } from "@/theme/tokens";
import { font } from "@/theme/typography";

export const toneColor: Record<StatusTone, string> = {
  active: colors.info,
  waiting: colors.warning,
  done: colors.success,
  failed: colors.danger,
  neutral: colors.textMuted,
};

export function StatusPill({ view, label }: { view?: Block; label?: string }) {
  const info = statusInfo(view);
  const color = toneColor[info.tone];
  return (
    <View
      accessible
      accessibilityLabel={t("Status: {status}", { status: label ?? info.label })}
      style={[styles.pill, { borderColor: color + "55", backgroundColor: color + "1F" }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label ?? info.label}
      </Text>
    </View>
  );
}

// "New activity" marker for surfaces; distinct from unread message counts.
export function ActivityDot({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;
  return (
    <View
      accessible
      accessibilityLabel={t("New activity")}
      style={styles.activity}
    />
  );
}

export function CountBadge({ count, tone = "primary" }: { count: number; tone?: "primary" | "muted" }) {
  if (count <= 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={t("{count} unread", { count })}
      style={[styles.badge, tone === "muted" && styles.badgeMuted]}
    >
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  activity: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeMuted: { backgroundColor: colors.borderStrong },
  badgeText: { fontFamily: font.semibold, fontSize: 11, color: colors.primaryText },
});
