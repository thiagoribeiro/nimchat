"use client";
import { t } from "@nimchat/i18n";
import { dateLocale } from "@/lib/date-locale";
import { format } from "date-fns";
import type { Surface, Trust } from "@nimchat/brian";
import { BlockView } from "@/components/brian/block-view";
import { ChatItem } from "./chat-item";
import { UserAvatar } from "@/components/user-avatar";
import type { TimelineRow } from "@nimchat/brian/agent-timeline";

export function AgentTurn({ row, surfaces, trust, reactions }: {
  row: TimelineRow; surfaces: Map<string, Surface>; trust: Trust;
  reactions: Map<string, Map<string, number>>;
}) {
  if (!row.speaker) return <ChatItem event={row.events[0]} roomId={row.events[0].room_id}
    surfaces={surfaces} trust={trust} reactions={reactions.get(row.events[0].event_id)} />;
  const roomId = row.activities[0]?.roomId ?? row.events[0].room_id;
  return <div data-agent-turn={row.key} className="flex w-full gap-2 rounded-xl p-3">
    <UserAvatar />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2"><p className="text-sm font-semibold">{row.speaker.name}</p>
        <span className="text-xs text-zinc-400">{format(new Date(row.events[0]?.origin_server_ts ?? row.activities[0].activityAt), t("MMM d yyyy, HH:mm"), { locale: dateLocale() })}</span></div>
      {row.activities.map(surface => <BlockView key={surface.key} block={surface.block} roomId={roomId} trust={trust} />)}
      {row.events.map(event => <ChatItem key={event.event_id} event={event} roomId={roomId} surfaces={surfaces}
        trust={trust} reactions={reactions.get(event.event_id)} embedded />)}
    </div>
  </div>;
}
