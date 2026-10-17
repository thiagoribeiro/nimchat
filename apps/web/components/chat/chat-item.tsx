"use client";

import { t } from "@nimchat/i18n";
import { dateLocale } from "@/lib/date-locale";
import { decode, fallback, instanceKey } from "@nimchat/brian";
import type { Surface, Trust } from "@nimchat/brian";
import { useAuthStore } from "@nimchat/sdk";
import type {
  AttachmentContent,
  MessageContent,
  NimletEvent,
} from "@nimchat/sdk";
import { format } from "date-fns";
import { FileIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { EmojiPicker } from "@/components/emoji-picker";
import { UserAvatar } from "@/components/user-avatar";
import { getNimletClient } from "@/lib/nimlet";

import { AgentStatus } from "@/components/brian/agent-status";
import { SurfaceReference } from "@/components/brian/surface-reference";
import { BlockView } from "@/components/brian/block-view";


interface ChatItemProps {
  event: NimletEvent;
  reactions?: Map<string, number>;
  roomId: string;
  surfaces: Map<string, Surface>;
  trust: Trust;
  embedded?: boolean;
}

export function ChatItem({ event, reactions, roomId, surfaces, trust, embedded = false }: ChatItemProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const showIdentity = !embedded && !trust.publishers.has(event.sender_id);
  const isOwn = event.sender_id === currentUserId;


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
    <div className={`relative group flex items-center rounded-xl ${embedded ? "py-1" : "p-3"} transition hover:bg-[#1A2338] w-full`}>
      <div className="group flex gap-x-2 items-center w-full">
        {showIdentity && <UserAvatar />}
        <div className="flex flex-col w-full">
          {showIdentity && <div className="flex items-center gap-x-2">
            <p className="font-semibold text-sm">
              {event.sender_display_name}
              {isOwn && <span className="text-zinc-400 font-normal"> {t("(you)")}</span>}
            </p>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {format(new Date(event.origin_server_ts), t("MMM d yyyy, HH:mm"), { locale: dateLocale() })}
            </span>
          </div>}

          {event.type === "m.room.message" && (
            <p className="text-sm text-slate-300">
              {(event.content as MessageContent).body}
            </p>
          )}
          {event.type === "m.ui.message" && decode(event.content).map((block,index)=>{
            const trusted=trust.agents.has(event.sender_id)||trust.publishers.has(event.sender_id);
            if(block.type!=="plugin")return <BlockView key={index} block={block} roomId={roomId} trust={trust}/>;
            if(!trusted)return <p key={index} className="whitespace-pre-wrap text-sm text-slate-300">{fallback(block)}</p>;
            const latest=surfaces.get(instanceKey(roomId,block.plugin,block.instance_id))?.block??block;
            if(block.plugin==="agent_status")return <AgentStatus key={index} block={latest} roomId={roomId} userId={trust.userId}/>;
            return <SurfaceReference key={index} block={block} roomId={roomId} surfaces={surfaces}/>;
          })}
          {event.type === "m.room.attachment" && (
            <AttachmentPreview content={event.content as AttachmentContent} />
          )}

          {reactions && reactions.size > 0 && (
            <div className="flex gap-1 mt-1">
              {Array.from(reactions.entries()).map(([emoji, count]) => (
                <span
                  key={emoji}
                  className="text-xs bg-zinc-200/70 dark:bg-zinc-700/50 rounded-full px-2 py-0.5"
                >
                  {emoji} {count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {!trust.publishers.has(event.sender_id) && <div className="hidden group-hover:flex items-center absolute p-1 -top-2 right-5 bg-white dark:bg-zinc-800 border rounded-sm">
        <EmojiPicker onChange={onReact} />
      </div>}
    </div>
  );
}

function AttachmentPreview({ content }: { content: AttachmentContent }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isImage = content.mimetype?.startsWith("image/") ?? false;

  useEffect(() => {
    let revoke: string | null = null;
    let disposed = false;
    getNimletClient()
      .fetchMediaObjectUrl(content.content_uri)
      .then((url) => {
        if (disposed) { URL.revokeObjectURL(url); return; }
        revoke = url;
        setObjectUrl(url);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.content_uri]);

  if (isImage) {
    return (
      <div className="mt-2 w-full max-w-xl">
      <a
        href={objectUrl ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("Open image at full size")}
        className="relative rounded-md overflow-hidden border flex items-center justify-center bg-secondary min-h-[120px]"
      >
        {objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={objectUrl} alt={content.caption ?? content.filename ?? "attachment"} className="object-contain w-full max-h-[480px]" />
        ) : (
          <span className="text-xs text-zinc-500">{t("Loading...")}</span>
        )}
      </a>
      {!!content.caption && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{content.caption}</p>}
      </div>
    );
  }

  return (
    <div className="relative flex items-center p-2 mt-2 rounded-md bg-background/10">
      <FileIcon className="h-10 w-10 fill-indigo-200 stroke-indigo-400" />
      {objectUrl ? (
        <a
          href={objectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-sm text-indigo-500 dark:text-indigo-400 hover:underline"
        >
          {content.filename ?? t("Download")}
        </a>
      ) : (
        <span className="ml-2 text-sm text-zinc-500">{content.filename ?? t("Loading...")}</span>
      )}
    </div>
  );
}
