"use client";
import { t } from "@nimchat/i18n";
import { instanceKey, pluginLabel, statusInfo, surfaceTitle, fallback } from "@nimchat/brian";
import type { Block, Surface } from "@nimchat/brian";
import { ArrowUpRight, Layers } from "lucide-react";
import Link from "next/link";
export function SurfaceReference({roomId,block,surfaces}:{roomId:string;block:Block;surfaces:Map<string,Surface>}) {
  const surface=surfaces.get(instanceKey(roomId,block.plugin,block.instance_id));
  if (!surface) return <p className="whitespace-pre-wrap text-sm text-slate-300">{fallback(block)}</p>;
  const dest="/rooms/"+encodeURIComponent(roomId)+"/surfaces/"+encodeURIComponent(block.plugin)+"/"+encodeURIComponent(block.instance_id);
  return <Link href={dest} className="mt-2 flex max-w-xl items-center gap-3 rounded-xl border border-[#334155] bg-[#1A2338] p-3 hover:border-violet-500">
    <Layers size={23} className="shrink-0 text-violet-300" />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{surfaceTitle(surface)}</span><span className="text-xs text-slate-400">{pluginLabel(block.plugin)} · {statusInfo(surface.block.view).label}</span></span>
    <span className="flex items-center text-xs text-violet-300">{t("Open")} <ArrowUpRight size={15}/></span>
  </Link>;
}
