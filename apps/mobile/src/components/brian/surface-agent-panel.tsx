import { t } from "@nimchat/i18n";
import { decode, fallback, formQuestion } from "@nimchat/brian";
import { Text, View } from "react-native";
import { useRoomEvents, useRoomSurfaces } from "@/lib/brian";
import { Markdown } from "@/components/chat/markdown";
import { colors } from "@/theme/tokens";
import { AgentStatus } from "./agent-status";
import { SurfaceReference } from "./surface-reference";
export function SurfaceAgentPanel({ roomId }: { roomId: string }) {
  const events = useRoomEvents(roomId),
    { surfaces, trust } = useRoomSurfaces(roomId);
  const statuses = [...surfaces.values()]
    .filter((s) => s.block.plugin === "agent_status")
    .sort((a, b) => b.activity - b.activity)
    .slice(0, 3);
  const replies = events
    .filter(
      (e) =>
        trust.agents.has(e.sender_id) &&
        ["m.room.message", "m.ui.message"].includes(e.type),
    )
    .slice(-3);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted }}>{t("Brian on this surface")}</Text>
      {[...surfaces.values()].filter(s => formQuestion(s.block) && s.block.view.owner_id === trust.userId && ["draft","invalid"].includes(s.block.view.status)).map(s =>
        <SurfaceReference key={s.key} roomId={roomId} block={s.block} />
      )}
      {statuses.map((s) => (
        <AgentStatus
          key={s.key}
          block={s.block}
          roomId={roomId}
          trust={trust}
        />
      ))}
      {replies.map((e) => (
        <Markdown
          key={e.event_id}
          text={
            e.type === "m.room.message"
              ? String((e.content as any).body ?? "")
              : decode(e.content)
                  .filter((b) => b.type !== "plugin")
                  .map(fallback)
                  .join("\n")
          }
        />
      ))}
    </View>
  );
}
