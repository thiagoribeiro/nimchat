"use client";
import { t, locale } from "@nimchat/i18n";
import { useChatStore } from "@nimchat/sdk";

import {
  surfaceReference,
  canEdit,
  pluginLabel
} from "@nimchat/brian";
import type { Surface, Block } from "@nimchat/brian";
import { useRoom } from "@/components/chat/room-provider";

import { Paperclip } from "lucide-react";
import React, { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Input } from "@/components/ui/input";
import { EmojiPicker } from "@/components/emoji-picker";
import { getNimletClient } from "@/lib/nimlet";
import type {
  AttachmentContent,
  MessageContent
} from "@nimchat/sdk";

interface ChatInputProps {
  roomId: string;
  name: string;
}

export function ChatInput({ roomId, name }: ChatInputProps) {
  const [content, setContent] = useState("");
  const continuation = useChatStore((s) => s.continuationByRoom[roomId]);
  const continuationReference = useChatStore((s) => s.continuationReferenceByRoom[roomId]);
  const [references, setReferences] = useState<Block[]>([]);
  const { surfaces, trust } = useRoom();
  const mention = content.match(/(?:^|\s)@([^@]*)$/)?.[1];
  const candidates =
    mention === undefined
      ? []
      : [...surfaces.values()]
          .filter(
            (s) =>
              !s.block.view.transfer &&
              canEdit(s.block.view, trust.userId) &&
              s.title.toLowerCase().includes(mention.toLowerCase())
          )
          .slice(0, 8);
  const select = (s: Surface) => {
    setContent((c) => c.replace(/@([^@]*)$/, "@" + s.title + " "));
    setReferences((refs) => [
      ...refs.filter(
        (r) => r.metadata?.instance_id !== s.block.instance_id
      ),
      surfaceReference(s)
    ]);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = content.trim();
    if (!body) return;
    setError("");
    try {
      await getNimletClient().sendEvent<MessageContent>(
        roomId,
        "m.room.message",
        uuidv4(),
        {
          msgtype: "m.text",
          body,
          metadata: {
            surface_references: [...references, ...(continuationReference ? [continuationReference] : [])],
            continuation_of: continuation
          }
        }
      );
      setContent("");
      setReferences([]);
      useChatStore.getState().setContinuation(roomId);
    } catch (err) {
      setError(
        t("Failed to send the message. The text was kept so you can try again.")
      );
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      const client = getNimletClient();
      const uploaded = await client.uploadMedia(file, file.name);
      await client.sendEvent<AttachmentContent>(
        roomId,
        "m.room.attachment",
        uuidv4(),
        {
          content_uri: uploaded.content_uri,
          filename: file.name,
          mimetype: file.type,
          size: file.size
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="relative p-4 pb-6 bg-[#0F172A] border-t border-[#26324A]"
    >
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {continuation && (
        <p className="mb-2 text-sm text-violet-300">
          {t("Replying to the selected request")}{" "}
          <button
            type="button"
            className="min-h-[44px]"
            onClick={() => useChatStore.getState().setContinuation(roomId)}
          >
            {t("Cancel linked reply")}
          </button>
        </p>
      )}
      {candidates.length > 0 && (
        <div className="mb-3 rounded-lg bg-slate-800">
          {candidates.map((s) => (
            <button
              type="button"
              key={s.key}
              className="block min-h-[44px] w-full p-2 text-left text-sm"
              onClick={() => select(s)}
            >
              {" "}
              @{s.title} · {pluginLabel(s.block.plugin)} ·{" "}
              {s.createdAt
                ? new Date(s.createdAt).toLocaleString(locale())
                : t("Date unavailable")}
            </button>
          ))}
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
      />
      <button
        type="button"
        aria-label={t("Upload file")}
        onClick={onPickFile}
        disabled={isUploading}
        className="absolute top-7 left-8 h-[24px] w-[24px] bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 dark:hover:bg-zinc-300 transition rounded-full p-1 flex items-center justify-center disabled:opacity-50"
      >
        <Paperclip className="h-4 w-4 text-white dark:text-[#313338]" />
      </button>
      <Input
        placeholder={t("Message {name}", { name: name === "direct" ? t("this conversation") : name })}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isUploading}
        className="px-14 py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200"
      />
      <div className="absolute top-7 right-8">
        <EmojiPicker
          onChange={(emoji: string) => setContent((c) => `${c}${emoji}`)}
        />
      </div>
    </form>
  );
}
