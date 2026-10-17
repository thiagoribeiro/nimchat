"use client";
import { t } from "@nimchat/i18n";
import { activeSurfaces, project } from "@nimchat/brian";
import type { Event } from "@nimchat/brian";
import { brianTrust } from "@/lib/brian";
import { AgentStatus } from "./agent-status";

export function AgentSurfaces({events,userId}:{events:Event[];userId:string}) {
  const items=activeSurfaces(project(events,brianTrust(userId))).filter(s=>s.block.plugin==="agent_status");
  if (!items.length) return null;
  return <aside aria-label={t("Agent activity")} className="mx-4 mb-4 space-y-2">
    <p className="text-xs opacity-70">{t("Agent activity ({count})", { count: items.length })}</p>
    {items.map(s=><AgentStatus key={s.key} block={s.block} roomId={s.roomId} userId={userId}/>)}
  </aside>;
}
