import { t } from "@nimchat/i18n";
import { useAuthStore } from "@nimchat/sdk";
import { CircleAlert, RotateCw, X } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Markdown } from "@/components/chat/markdown";
import { Avatar } from "@/components/ui/avatar";
import { useOutbox } from "@/lib/outbox";
import type { OutgoingMessage } from "@/lib/outbox";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

// Local echo of a message being sent: honest about sending/failed states.
export function OutgoingItem({ item, senderId }: { item: OutgoingMessage; senderId: string }) {
  const name = useAuthStore((s) => s.displayName ?? s.username ?? t("You"));
  const retry = useOutbox((s) => s.retry);
  const discard = useOutbox((s) => s.discard);
  const failed = item.status === "failed";
  return (
    <View style={[styles.row, !failed && styles.sending]}>
      <Avatar name={name} seed={senderId} size={36} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.sender}>{name}</Text>
          {failed ? (
            <View style={styles.state}>
              <CircleAlert size={12} color={colors.danger} />
              <Text style={[type.caption, { color: colors.danger }]}>{t("Not sent")}</Text>
            </View>
          ) : (
            <View style={styles.state} accessibilityLabel={t("Sending")}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={type.caption}>{t("Sending…")}</Text>
            </View>
          )}
        </View>
        <Markdown text={item.body} />
        {failed && (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Try sending again")}
              onPress={() => retry(item.txn)}
              style={styles.action}
            >
              <RotateCw size={14} color={colors.link} />
              <Text style={styles.actionText}>{t("Try again")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Discard message")}
              onPress={() => discard(item.txn)}
              style={styles.action}
            >
              <X size={14} color={colors.textMuted} />
              <Text style={[styles.actionText, { color: colors.textMuted }]}>{t("Discard")}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  sending: { opacity: 0.7 },
  content: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: 2 },
  sender: { fontFamily: font.semibold, fontSize: 14, color: colors.text },
  state: { flexDirection: "row", alignItems: "center", gap: 4 },
  actions: { flexDirection: "row", gap: space.sm },
  action: {
    minHeight: touch - 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  actionText: { fontFamily: font.medium, fontSize: 13, color: colors.link },
});
