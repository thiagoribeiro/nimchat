import { t } from "@nimchat/i18n";
import { fallback, hasNews, instanceKey, pluginLabel, surfaceTitle } from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Markdown } from "@/components/chat/markdown";
import { PluginIcon } from "@/components/ui/plugin-icon";
import { ActivityDot, StatusPill } from "@/components/ui/status";
import { useBrianRead, usePendingCommand, useRoomSurfaces } from "@/lib/brian";
import { routes } from "@/lib/routes";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

// Compact timeline card for a stateful plugin instance (UX Spec v2 §3.1).
// The interactive component lives only in the focus view; this card shows the
// projected title/status and opens the instance owned by this room.
export function SurfaceReference({ roomId, block }: { roomId: string; block: Block }) {
  const { surfaces } = useRoomSurfaces(roomId);
  const surface = surfaces.get(instanceKey(roomId, block.plugin, block.instance_id));
  const news = useBrianRead((s) => (surface ? hasNews(surface, s.seen) : false));
  const { pending } = usePendingCommand(roomId, surface?.block ?? block);

  if (!surface) return <Markdown text={fallback(block)} />;

  const title = surfaceTitle(surface);
  const open = () => router.push(routes.surface(roomId, block.plugin, block.instance_id, "messages"));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("{plugin}: {title}. Open surface", { plugin: pluginLabel(block.plugin), title })}
      accessibilityHint={t("Opens the full component of this conversation")}
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PluginIcon plugin={block.plugin} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={type.bodyStrong} numberOfLines={2}>
            {title}
          </Text>
          <ActivityDot visible={news} />
        </View>
        <View style={styles.meta}>
          <Text style={type.caption}>{pluginLabel(block.plugin)}</Text>
          <StatusPill view={surface.block.view} />
        </View>
        {pending && !pending.rejected && (
          <View style={styles.meta}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={type.caption}>{t("Waiting for the plugin…")}</Text>
          </View>
        )}
        {pending?.rejected && <Text style={styles.error}>{t("Command refused: {reason}", { reason: t(pending.rejected) })}</Text>}
      </View>
      <View style={styles.open}>
        <Text style={styles.openText}>{t("Open")}</Text>
        <ChevronRight size={16} color={colors.link} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.sm,
    minHeight: touch + 16,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  error: { ...type.caption, color: colors.danger },
  open: { flexDirection: "row", alignItems: "center", gap: 2 },
  openText: { fontFamily: font.semibold, fontSize: 13, color: colors.link },
});
