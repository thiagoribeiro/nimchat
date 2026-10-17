import { t } from "@nimchat/i18n";
import { useAuthStore } from "@nimchat/sdk";
import type {
  AttachmentContent,
  MessageContent,
  NimletEvent,
} from "@nimchat/sdk";
import { format } from "date-fns";
import { dateLocale } from "@/lib/date-locale";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { v4 as uuidv4 } from "uuid";

import { decode, fallback, instanceKey } from "@nimchat/brian";
import type { Surface } from "@nimchat/brian";
import { BlockView } from "@/components/brian/block-view";
import { SurfaceReference } from "@/components/brian/surface-reference";
import { Markdown } from "@/components/chat/markdown";
import { AttachmentPreview } from "@/components/chat/attachment-preview";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { Avatar } from "@/components/ui/avatar";
import { useTrust } from "@/lib/brian";
import { getNimletClient } from "@/lib/nimlet";
import { colors, radius, space } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

const TIME_FORMAT = "HH:mm";

interface ChatItemProps {
  event: NimletEvent;
  reactions?: Map<string, number>;
  roomId: string;
  highlighted?: boolean;
  surfaces: Map<string, Surface>;
  embedded?: boolean;
}

export function when(ts: number) {
  const date = new Date(ts);
  const today = new Date().toDateString() === date.toDateString();
  return format(date, today ? TIME_FORMAT : t("MMM d, HH:mm"), { locale: dateLocale() });
}

export const ChatItem = memo(function ChatItem({
  event,
  reactions,
  roomId,
  highlighted = false,
  surfaces,
  embedded = false,
}: ChatItemProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const trust = useTrust();
  const showIdentity = !embedded && !trust.publishers.has(event.sender_id);
  const isOwn = event.sender_id === currentUserId;
  const trusted =
    trust.agents.has(event.sender_id) || trust.publishers.has(event.sender_id);

  const onReact = async (emoji: string) => {
    try {
      await getNimletClient().sendEvent(roomId, "m.room.reaction", uuidv4(), {
        relates_to: event.event_id,
        emoji,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={[styles.row, embedded && styles.embedded, highlighted && styles.highlighted]}>
      {showIdentity && <Avatar name={event.sender_display_name} seed={event.sender_id} size={36} />}
      <View style={styles.content}>
        {showIdentity && <View style={styles.headerRow}>
          <Text style={styles.sender} numberOfLines={1}>
            {event.sender_display_name}
            {isOwn && <Text style={styles.you}> {t("(you)")}</Text>}
          </Text>
          <Text style={type.caption}>{when(event.origin_server_ts)}</Text>
        </View>}

        {event.type === "m.room.message" && (
          <Markdown text={(event.content as MessageContent).body} />
        )}
        {event.type === "m.ui.message" &&
          decode(event.content).map((block, index) => {
            if (block.type !== "plugin")
              return <BlockView key={index} block={block} roomId={roomId} trust={trust} />;
            // Only trusted senders can materialize a surface; anything else is
            // shown as its readable fallback, never as an interactive card.
            if (!trusted) return <Markdown key={index} text={fallback(block)} />;
            // Keep the compact activity line in the timeline, but render the
            // latest trusted projection. The original creation event does not
            // change when m.plugin.state.updated arrives.
            if (block.plugin === "agent_status") {
              const latest = surfaces.get(instanceKey(roomId, block.plugin, block.instance_id))?.block ?? block;
              return <BlockView key={index} block={latest} roomId={roomId} trust={trust} />;
            }
            return <SurfaceReference key={index} roomId={roomId} block={block} />;
          })}
        {event.type === "m.room.attachment" && (
          <AttachmentPreview content={event.content as AttachmentContent} />
        )}

        {reactions && reactions.size > 0 && (
          <View style={styles.reactions}>
            {Array.from(reactions.entries()).map(([emoji, count]) => (
              <View key={emoji} style={styles.pill} accessibilityLabel={`${emoji} ${count}`}>
                <Text style={styles.pillText}>
                  {emoji} {count}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {!trust.publishers.has(event.sender_id) && <EmojiPicker onChange={onReact} />}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  embedded: { paddingHorizontal: 0, paddingVertical: 2 },
  highlighted: { backgroundColor: colors.primarySoft },
  content: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginBottom: 2 },
  sender: { fontFamily: font.semibold, fontSize: 14, color: colors.text, flexShrink: 1 },
  you: { fontFamily: font.regular, color: colors.textMuted },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pill: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  pillText: { fontFamily: font.medium, color: colors.textSecondary, fontSize: 12 },
});
