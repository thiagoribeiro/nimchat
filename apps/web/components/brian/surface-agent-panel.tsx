"use client";
import { t } from "@nimchat/i18n";
import { decode, fallback, formQuestion } from "@nimchat/brian";
import { useRoom } from "@/components/chat/room-provider";
import { AgentStatus } from "./agent-status";
import { SurfaceReference } from "./surface-reference";
export function SurfaceAgentPanel() {
  const { events, surfaces, roomId, trust } = useRoom();
  const statuses = [...surfaces.values()]
    .filter((s) => s.block.plugin === "agent_status")
    .sort((a, b) => b.activity - b.activity)
    .slice(0, 3);
  const replies = events
    .filter(
      (e) =>
        trust.agents.has(e.sender_id) &&
        ["m.room.message", "m.ui.message"].includes(e.type)
    )
    .slice(-3);
  return (
    <div className="space-y-2">
      <h3 className="text-sm text-slate-400">{t("Brian on this surface")}</h3>
      {[...surfaces.values()].filter(s => formQuestion(s.block) && s.block.view.owner_id === trust.userId && ["draft","invalid"].includes(s.block.view.status)).map(s =>
        <SurfaceReference key={s.key} roomId={roomId} block={s.block} surfaces={surfaces} />
      )}
      {statuses.map((s) => (
        <AgentStatus
          key={s.key}
          block={s.block}
          roomId={roomId}
          userId={trust.userId}
        />
      ))}
      {replies.map((e) => (
        <p key={e.event_id} className="whitespace-pre-wrap text-sm">
          {e.type === "m.room.message"
            ? String((e.content as any).body ?? "")
            : decode(e.content)
                .filter((b) => b.type !== "plugin")
                .map(fallback)
                .join("\n")}
        </p>
      ))}
    </div>
  );
}
