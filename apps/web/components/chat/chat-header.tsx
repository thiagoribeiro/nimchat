"use client";

import { t, tn } from "@nimchat/i18n";
import { Layers, MessageCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileToggle } from "@/components/mobile-toggle";
import { SyncIndicator } from "@/components/sync-indicator";
import { useModal } from "@/hooks/use-modal-store";
import { useRoom } from "@/components/chat/room-provider";
import { surfaceSections } from "@nimchat/brian";

export function ChatHeader() {
  const { roomId, name, surfaces } = useRoom();
  const pathname = usePathname();
  const inSurfaces = pathname.includes("/surfaces");
  const onOpen = useModal((s) => s.onOpen);
  const counts = surfaceSections(surfaces, roomId);
  const active = counts.active.length + counts.pinned.length;
  const display = name === "direct" ? t("Direct message") : name;
  const roomUrl = "/rooms/" + encodeURIComponent(roomId);

  return (
    <header className="shrink-0 border-b border-[#26324A] bg-[#0F172A]">
      <div className="flex h-16 items-center gap-3 px-4">
        <MobileToggle />
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
          <MessageCircle size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{display}</h1>
          <p className="text-xs text-slate-400">{active ? tn(active, "{count} active surface", "{count} active surfaces") : t("Conversation")}</p>
        </div>
        {name !== "direct" && (
          <button
            type="button"
            onClick={() => onOpen("invite", { roomId, roomName: name })}
            title={t("Invite person")}
            aria-label={t("Invite a person to this room")}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-300 hover:bg-[#1A2338]"
          >
            <UserPlus size={19} />
          </button>
        )}
        <SyncIndicator />
      </div>
      <nav className="flex gap-2 px-4 pb-2" aria-label={t("Conversation sections")}>
        <Link
          href={roomUrl}
          aria-current={!inSurfaces ? "page" : undefined}
          className={"inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 text-sm " +
            (!inSurfaces ? "bg-violet-500/20 font-semibold text-violet-200" : "text-slate-400 hover:bg-[#1A2338]")}
        >
          <MessageCircle size={16} /> {t("Messages")}
        </Link>
        <Link
          href={roomUrl + "/surfaces"}
          aria-current={inSurfaces ? "page" : undefined}
          className={"inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 text-sm " +
            (inSurfaces ? "bg-violet-500/20 font-semibold text-violet-200" : "text-slate-400 hover:bg-[#1A2338]")}
        >
          <Layers size={16} /> {t("Surfaces")}
          {active > 0 && <span className="rounded-full bg-violet-500/20 px-2 text-xs">{active}</span>}
        </Link>
      </nav>
    </header>
  );
}
