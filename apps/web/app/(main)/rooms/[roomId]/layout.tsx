"use client";
import { t } from "@nimchat/i18n";
import { isSharedRoom } from "@nimchat/brian";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useChatStore } from "@nimchat/sdk";

import { RoomProvider } from "@/components/chat/room-provider";
import { ChatHeader } from "@/components/chat/chat-header";

export default function RoomLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ roomId: string }>();
  const room = useChatStore((s) => s.rooms[params.roomId]);
  if (room?.state !== "join") {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
        {t("You are not in this conversation. Accept the invitation to open its messages and surfaces.")}
      </div>
    );
  }
  return (
    <RoomProvider roomId={params.roomId}>
      <section className="flex h-full min-h-0 flex-col bg-[#0B1222] text-slate-100">
        {!isSharedRoom(room?.name ?? "") && <ChatHeader />}
        {children}
      </section>
    </RoomProvider>
  );
}
