"use client";
import { t } from "@nimchat/i18n";
import { SurfaceAgentPanel } from "./surface-agent-panel";
import {
  canEdit,
  creationLabel,
  referenceTarget
  , formQuestion, surfaceReference
} from "@nimchat/brian";
import type { Surface, Block } from "@nimchat/brian";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@nimchat/sdk";
import { pluginCommands, usePluginCommands } from "@/lib/plugin-commands";
import { getNimletClient } from "@/lib/nimlet";
import { v4 as uuid } from "uuid";
export function SurfaceManagement({
  surface,
  user
}: {
  surface: Surface;
  user: string;
}) {
  const [name, setName] = useState(surface.title),
    [invitees, setInvitees] = useState(""),
    [question, setQuestion] = useState(""),
    [error, setError] = useState(""),
    [review, setReview] = useState(false);
  const router = useRouter();
  const continuation = useChatStore(
    (s) => s.continuationByRoom[surface.roomId]
  );
  const rooms = useChatStore((s) => s.rooms);
  const view = surface.block.view;
  const owner = view.owner_id === user;
  const structuredQuestion = formQuestion(surface.block);
  const pending = usePluginCommands((s) => s.commands.find((c) => c.roomId === surface.roomId && c.plugin === surface.block.plugin && c.instanceId === surface.block.instance_id && c.status !== "rejected"));
  const selected = invitees.split(",").map((s) => s.trim()).filter(Boolean);
  const preview = review && JSON.stringify(view.sharing_preview?.invitees) === JSON.stringify(selected) ? view.sharing_preview : undefined;
  useEffect(() => {
    if (
      view.transfer?.phase === "moved" &&
      rooms[view.transfer.room_id]?.state === "join"
    )
      router.replace(
        "/shared/" + encodeURIComponent(view.transfer.room_id)
      );
  }, [view.transfer, rooms, router]);
  const send = async (command: string, payload: Block = {}) => {
    setError("");
    try {
      await pluginCommands
        .getState()
        .send(surface.roomId, surface.block, command, payload);
    } catch {
      setError(t("Could not save the command. Try again."));
    }
  };
  const open = (room: string, plugin: string, id: string) => {
    if (rooms[room]?.state !== "join") {
      setError(
        t("Accept the surface invitation in Surfaces to open it.")
      );
      return;
    }
    router.push(
      `/shared/${encodeURIComponent(room)}`
    );
  };
  return (
    <section className="space-y-3 rounded-xl border border-slate-700 p-4">
      <p className="text-xs text-slate-400">
        {creationLabel(surface.createdAt)}
      </p>
      {structuredQuestion && owner && !["submitted", "cancelled"].includes(view.status) && (
        <div className="space-y-2">
          <p>{t("Fill in and submit so Brian can continue your request.")}</p>
          <button className="min-h-[44px] text-violet-300" onClick={() => {
            useChatStore.getState().setContinuation(surface.roomId, structuredQuestion.request_event_id, surfaceReference(surface));
            router.push(`/rooms/${encodeURIComponent(surface.roomId)}`);
          }}>{t("Reply in the chat")}</button>
        </div>
      )}
      {view.transfer ? (
        <div role="status">
          <p>
            {view.transfer.phase === "moved"
              ? t("Moved to another room")
              : t("Transfer in progress")}
          </p>
          {view.transfer.room_id && (
            <button
              className="min-h-[44px] text-violet-300"
              onClick={() =>
                open(
                  view.transfer.room_id,
                  surface.block.plugin,
                  view.transfer.instance_id
                )
              }
            >
              {t("Open shared surface")}
            </button>
          )}
          {owner && view.transfer.phase === "preparing" && (
            <button
              className="min-h-[44px] text-red-300"
              onClick={() => void send("cancel_transfer")}
            >
              {t("Cancel transfer")}
            </button>
          )}
        </div>
      ) : (
        process.env.NEXT_PUBLIC_BRIAN_SURFACE_NAMES_ENABLED !== "false" &&
        canEdit(view, user) &&
        ["checklist", "poll", "form_stateful", "monthly_bills"].includes(
          surface.block.plugin
        ) && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send("rename", { title: name });
            }}
          >
            <input
              aria-label={t("Surface name")}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded bg-slate-900 p-2"
            />
            <button className="min-h-[44px] text-violet-300">
              {t("Rename")}
            </button>
          </form>
        )
      )}
      {owner &&
        !view.transfer &&
        ["checklist", "monthly_bills"].includes(surface.block.plugin) &&
        process.env.NEXT_PUBLIC_BRIAN_SHARING_ENABLED === "true" && (
          <div className="space-y-3">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              if (view.shared) {
                if (selected.length !== 1) { setError(t("Invite one person at a time.")); return; }
                if (window.confirm(t("Send an invitation to @{name}?", { name: selected[0] }))) void send("invite_participant", { username: selected[0] });
              } else { setReview(true); void send("preview_share", { invitees: selected }); }
            }}>
              <label>{t("Share with whom?")}
                <input aria-label={t("Guests by username")} placeholder={t("user1, user2")} value={invitees} onChange={(e) => { setInvitees(e.target.value); setReview(false); }} className="w-full rounded bg-slate-900 p-2" />
              </label>
              <p className="text-sm text-slate-400">{t("You will review the participants before confirming.")}</p>
              <button disabled={!!pending || (view.shared && !invitees.trim())} className="min-h-[44px] text-violet-300 disabled:opacity-50">{view.shared ? t("Invite person") : t("Review participants")}</button>
            </form>
            {!!preview && !view.shared && <div className="space-y-2">
              <p>{t("Participants who will have editor access:")}</p>
              <ul>{(preview.participants ?? []).map((p: Block) => <li key={p.user_id}>@{p.username}{p.user_id === user ? t(" (you, owner)") : ""}</li>)}</ul>
              <p>{t("The list will move to Surfaces and a shortcut will stay in this conversation. The other people will need to accept the invitation.")}</p>
              <button disabled={!!pending} className="min-h-[44px] text-violet-300 disabled:opacity-50" onClick={() => {
                if (window.confirm(t("{people} will have access. Move the list and send the invitations?", { people: (preview.participants ?? []).map((p: Block) => "@" + p.username).join(", ") }))) void send("share", { preview_token: preview.token });
              }}>{t("Confirm sharing")}</button>
              <button className="ml-4 min-h-[44px]" onClick={() => setReview(false)}>{t("Cancel sharing")}</button>
            </div>}
          </div>
        )}
      {view.shared && (
        <div>
          <h3 className="text-sm">{t("Participants")}</h3>
          {(view.shared.participants ?? [])
            .filter((p: Block) => p.state !== "leave")
            .map((p: Block) => (
              <div
                key={p.user_id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  {p.username}{" "}
                  {p.state === "invite" ? t("· invitation sent") : ""}
                </span>
                {owner && p.user_id !== user && (
                  <button
                    className="min-h-[44px] text-red-300"
                    onClick={() => {
                      if (window.confirm(t("Remove this person's access?")))
                        void send("remove_participant", {
                          user_id: p.user_id
                        });
                    }}
                  >
                    {t("Remove")}
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
      {surface.block.plugin === "agent_status" &&
        view.status === "waiting_user" &&
        view.owner_id === user && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!question.trim()) return;
              try {
                await getNimletClient().sendEvent(
                  surface.roomId,
                  "m.room.message",
                  uuid(),
                  {
                    msgtype: "m.text",
                    body: question,
                    metadata: { continuation_of: view.request_id }
                  }
                );
                setQuestion("");
              } catch {
                setError(t("Failed to send the reply."));
              }
            }}
          >
            <label>
              {t("Reply to this request")}
              <input
                aria-label={t("Reply for this request")}
                className="block w-full rounded bg-slate-900 p-2"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
            <button className="min-h-[44px] text-violet-300">
              {t("Send reply")}
            </button>
          </form>
        )}
      {view.shared && <SurfaceAgentPanel />}
      {view.shared && continuation && (
        <p className="text-sm text-violet-300">
          {t("Replying to the selected request")}{" "}
          <button
            onClick={() =>
              useChatStore.getState().setContinuation(surface.roomId)
            }
          >
            {t("Unlink")}
          </button>
        </p>
      )}
      {view.shared && !view.transfer && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!question.trim()) return;
            try {
              await getNimletClient().sendEvent(
                surface.roomId,
                "m.room.message",
                uuid(),
                {
                  msgtype: "m.text",
                  body: question,
                  metadata: { continuation_of: continuation }
                }
              );
              setQuestion("");
              useChatStore.getState().setContinuation(surface.roomId);
            } catch {
              setError(t("Failed to send to Brian."));
            }
          }}
        >
          <input
            aria-label={t("Ask Brian")}
            placeholder={
              continuation
                ? t("Reply to the selected request")
                : t("Ask Brian")
            }
            className="w-full rounded bg-slate-900 p-2"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="min-h-[44px] text-violet-300">
            {t("Ask Brian")}
          </button>
        </form>
      )}
      {(error || view.sharing_error) && (
        <p role="alert" className="text-red-300">
          {error || t(view.sharing_error)}
        </p>
      )}
    </section>
  );
}
