"use client";
import { t } from "@nimchat/i18n";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MonthlyBills } from "./monthly-bills";

import {
  fallback,
  supported,
  statusInfo,
  instanceKey,
  overlayView,
  canEdit,
  referenceTarget,
  formInputValue
} from "@nimchat/brian";
import { useChatStore } from "@nimchat/sdk";
import Link from "next/link";
import type { Block, Trust } from "@nimchat/brian";
import { useEffect, useRef, useState, useMemo } from "react";
import { AgentStatus } from "@/components/brian/agent-status";
import { formValues, reconcileDraft, voteOptions } from "@/lib/form-draft";
import type { FormDraft } from "@/lib/form-draft";
import { pluginCommands, usePluginCommands } from "@/lib/plugin-commands";

export function BlockView({
  block,
  roomId,
  trust,
  focus = false,
  management
}: {
  block: Block;
  roomId: string;
  trust: Trust;
  focus?: boolean;
  management?: ReactNode;
}) {
  const rooms = useChatStore((s) => s.rooms);
  if (!supported(block))
    return <p className="whitespace-pre-wrap">{fallback(block)}</p>;
  if (block.type !== "plugin") {
    if (block.type === "reference") {
      const target = referenceTarget(block);
      return (
        <div>
          <p>{t(block.title)}</p>
          {target && rooms[target.roomId]?.state === "join" ? (
            <Link
              className="text-violet-300"
              href={`/rooms/${encodeURIComponent(target.roomId)}/surfaces/${encodeURIComponent(target.plugin)}/${encodeURIComponent(target.instanceId)}`}
            >
              {t("Open surface")}
            </Link>
          ) : (
            <p className="text-sm text-slate-400">
              {t("Join the shared surface to open it.")}
            </p>
          )}
        </div>
      );
    }

    if (block.type === "divider")
      return <hr className="my-3 border-[#334155]" />;
    if (block.type === "key_value")
      return (
        <dl>
          {(block.items ?? []).map((item: Block, i: number) => (
            <div key={i} className="flex gap-2 text-sm">
              <dt className="text-slate-400">{item.key}:</dt>
              <dd>{String(item.value ?? "—")}</dd>
            </div>
          ))}
        </dl>
      );
    return (
      <p className="whitespace-pre-wrap text-sm">
        {block.text ?? block.title ?? block.message ?? fallback(block)}
      </p>
    );
  }
  if (block.plugin === "agent_status")
    return (
      <AgentStatus block={block} roomId={roomId} userId={trust.userId} />
    );
  return (
    <PluginContent
      key={instanceKey(roomId, block.plugin, block.instance_id)}
      block={block}
      roomId={roomId}
      trust={trust}
      focus={focus}
      management={management}
    />
  );
}

function PluginContent({
  block,
  roomId,
  trust,
  focus = false,
  management
}: {
  block: Block;
  roomId: string;
  trust: Trust;
  focus?: boolean;
  management?: ReactNode;
}) {
  const router = useRouter();
  const key = instanceKey(roomId, block.plugin, block.instance_id);
  const pending = usePluginCommands((s) => s.pending[key]);
  const result = usePluginCommands((s) => s.results[key]);
  const ready = usePluginCommands(
    (s) => s.ready && s.userId === trust.userId
  );
  const commands = usePluginCommands((s) => s.commands);
  const view = useMemo(
    () =>
      block.plugin === "monthly_bills"
        ? block.view
        : overlayView(
            block.view,
            commands.filter(
              (c) =>
                c.roomId === roomId &&
                c.plugin === block.plugin &&
                c.instanceId === block.instance_id
            )
          ),
    [block.view, commands, roomId, block.plugin, block.instance_id]
  );
  const owner = view.owner_id === trust.userId;
  const terminalForm = ["submitted", "cancelled"].includes(view.status);
  const blocked =
    !ready ||
    !!block.view.transfer ||
    (!!pending && !["checklist", "monthly_bills"].includes(block.plugin));
  const [draft, setDraft] = useState<FormDraft>(() => ({
    values: formValues(view),
    dirty: {}
  }));
  const acknowledged = useRef<string | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const own =
      !!result &&
      result.eventId !== acknowledged.current &&
      view.revision >= result.revision;
    if (own) acknowledged.current = result.eventId;
    setDraft((current) => reconcileDraft(current, view, own));
  }, [view, result]);
  useEffect(() => {
    if (!pending) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  const change = (id: string, value: unknown) =>
    setDraft((current) => ({
      values: { ...current.values, [id]: value },
      dirty: { ...current.dirty, [id]: true }
    }));
  const send = (
    command: string,
    payload: Record<string, unknown> = {}
  ) => {
    if (blocked) return;
    setNotice("");
    void pluginCommands
      .getState()
      .send(roomId, block, command, payload)
      .catch(() =>
        setNotice(
          t("Could not store the command. Free up space and try again.")
        )
      );
  };
  const action = (
    label: string,
    command: string,
    payload: Record<string, unknown> = {},
    danger = false
  ) => (
    <button
      type="button"
      key={command}
      disabled={blocked}
      onClick={() => send(command, payload)}
      className={
        "min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 " +
        (danger
          ? "border border-red-500/50 text-red-300"
          : "bg-violet-600 text-white")
      }
    >
      {label}
    </button>
  );
  const status = statusInfo(view);
  const prolonged = !!pending && clock - pending.startedAt >= 30000;
  return (
    <article
      className={
        "space-y-4 rounded-xl border border-[#334155] bg-[#1A2338] " +
        (focus && block.plugin === "monthly_bills" ? "p-3" : "p-5")
      }
    >
      {!(focus && block.plugin === "monthly_bills") && (
        <div>
          <p className="text-lg font-semibold">
            {view.title ?? view.question ?? block.plugin}
          </p>
          <p className="mt-1 text-xs text-violet-300">{status.label}</p>
        </div>
      )}
      {block.plugin !== "monthly_bills" && view.description && (
        <p className="whitespace-pre-wrap text-sm text-slate-300">
          {String(view.description)}
        </p>
      )}
      {block.plugin === "workflow" && (
        <div className="space-y-2">
          {(view.steps ?? []).map((step: Block, i: number) => (
            <div
              key={step.id ?? i}
              className="rounded-lg bg-[#0F172A] p-3 text-sm"
            >
              <span className="text-violet-300">{i + 1}. </span>
              {step.title}{" "}
              <span className="text-slate-400">· {step.status}</span>
            </div>
          ))}
          {view.summary && (
            <p className="whitespace-pre-wrap text-sm">{view.summary}</p>
          )}
          {view.failure_description && (
            <p role="alert" className="text-sm text-red-300">
              {view.failure_description}
            </p>
          )}
          {action(t("Refresh"), "refresh")}
        </div>
      )}
      {block.plugin === "monthly_bills" && (
        <MonthlyBills
          view={view}
          user={trust.userId}
          focus={focus}
          management={management}
          preferenceKey={JSON.stringify([
            "bills-group",
            trust.userId,
            roomId,
            block.instance_id
          ])}
          storage={{
            getItem: (key) =>
              typeof window === "undefined"
                ? null
                : window.localStorage.getItem(key),
            setItem: (key, value) =>
              window.localStorage.setItem(key, value)
          }}
          commands={commands.filter(
            (c) =>
              c.roomId === roomId &&
              c.plugin === block.plugin &&
              c.instanceId === block.instance_id
          )}
          result={result}
          onOpen={() =>
            router.push(
              `/rooms/${encodeURIComponent(roomId)}/surfaces/monthly_bills/${encodeURIComponent(block.instance_id)}`
            )
          }
          send={(cmd, payload, retry) =>
            pluginCommands
              .getState()
              .send(roomId, block, cmd, payload, retry)
          }
        />
      )}
      {block.plugin === "approval" && (
        <div className="flex flex-wrap gap-2">
          {view.status === "pending" &&
          owner &&
          !(
            view.expires_at && Date.parse(view.expires_at) <= Date.now()
          ) ? (
            <>
              {action(t("Approve"), "approve")}
              {action(t("Reject"), "reject", {}, true)}
              {action(t("Cancel"), "cancel", {}, true)}
            </>
          ) : (
            <p className="text-sm text-slate-400">
              {owner
                ? t("Approval is not pending.")
                : t("Waiting for the owner.")}
            </p>
          )}
        </div>
      )}
      {block.plugin === "checklist" && (
        <div className="space-y-2">
          {(view.items ?? []).map((item: Block) => (
            <label
              key={item.id}
              className="flex min-h-[44px] items-center gap-3 rounded-lg bg-[#0F172A] px-3"
            >
              <input
                type="checkbox"
                checked={!!item.checked}
                disabled={
                  blocked ||
                  !canEdit(view, trust.userId) ||
                  !["open", "completed"].includes(view.status)
                }
                onChange={(e) =>
                  send(e.target.checked ? "check_item" : "uncheck_item", {
                    item_id: item.id
                  })
                }
              />
              <span>{item.label}</span>
            </label>
          ))}
          {owner && view.status === "open" && (
            <div className="flex flex-wrap gap-2">
              {action(t("Archive"), "archive")}
              {action(t("Cancel"), "cancel", {}, true)}
            </div>
          )}
        </div>
      )}
      {block.plugin === "poll" && (
        <div className="space-y-2">
          {view.title && view.question && (
            <p className="text-sm">{view.question}</p>
          )}
          {(view.options ?? []).map((option: Block) => {
            const selected: string[] =
              view.votes_by_user?.[trust.userId] ?? [];
            const chosen = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={chosen}
                disabled={blocked || view.status !== "open"}
                onClick={() => {
                  const next = voteOptions(
                    selected,
                    option.id,
                    !!view.allow_multiple
                  );
                  if (next === selected) {
                    setNotice(t("Keep at least one option selected."));
                    return;
                  }
                  send("vote", { option_ids: next });
                }}
                className="block min-h-[44px] w-full rounded-lg border border-[#334155] p-3 text-left text-sm disabled:opacity-60"
              >
                {chosen ? "✓ " : ""}
                {option.label} ({option.votes ?? 0})
              </button>
            );
          })}
          {owner && view.status === "open" && (
            <div className="flex gap-2">
              {action(t("poll::Close"), "close")}
              {action(t("Cancel"), "cancel", {}, true)}
            </div>
          )}
        </div>
      )}
      {block.plugin === "form_stateful" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (owner && !terminalForm && !blocked)
              send("submit", { values: draft.values });
          }}
        >
          {(view.fields ?? []).map((field: Block) => (
            <label key={field.id} className="block space-y-1 text-sm">
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.type === "boolean" ? (
                <select
                  aria-label={field.label}
                  disabled={!owner || blocked || terminalForm}
                  required={!!field.required}
                  value={
                    draft.values[field.id] === undefined
                      ? ""
                      : String(draft.values[field.id])
                  }
                  className="block min-h-[44px] w-full rounded-lg bg-[#0F172A] p-3"
                  onChange={(e) =>
                    change(
                      field.id,
                      e.target.value === ""
                        ? undefined
                        : e.target.value === "true"
                    )
                  }
                >
                  <option value="">{t("Select")}</option>
                  <option value="true">{t("Yes")}</option>
                  <option value="false">{t("No")}</option>
                </select>
              ) : field.type === "select" ? (
                <select
                  disabled={!owner || blocked || terminalForm}
                  required={!!field.required}
                  className="block w-full rounded-lg bg-[#0F172A] p-3"
                  value={String(draft.values[field.id] ?? "")}
                  onChange={(e) => change(field.id, e.target.value)}
                >
                  <option value="">{t("Select")}</option>
                  {(field.options ?? []).map((option: string) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  disabled={!owner || blocked || terminalForm}
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                        ? "date"
                        : "text"
                  }
                  required={!!field.required}
                  step={field.type === "number" ? "any" : undefined}
                  className="block min-h-[44px] w-full rounded-lg bg-[#0F172A] p-3"
                  value={String(draft.values[field.id] ?? "")}
                  onChange={(e) =>
                    change(
                      field.id,
                      formInputValue(field.type, e.target.value)
                    )
                  }
                />
              )}
              {view.errors?.[field.id] && (
                <span className="block text-red-300">
                  {t(view.errors[field.id])}
                </span>
              )}
            </label>
          ))}
          {owner && !terminalForm && (
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={blocked}
                className="min-h-[44px] rounded-lg bg-violet-600 px-4 py-3 text-sm disabled:opacity-50"
              >
                {t("Submit form")}
              </button>
              {action(t("Save"), "save", { values: draft.values })}
              {action(t("Cancel"), "cancel", {}, true)}
            </div>
          )}
        </form>
      )}
      {notice && (
        <p role="status" className="text-sm text-amber-300">
          {notice}
        </p>
      )}
      {pending && pending.status !== "rejected" && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-violet-300">
            {pending.status === "sending"
              ? t("Sending command…")
              : pending.status === "failed"
                ? t("Delivery not confirmed.")
                : prolonged
                  ? t("The plugin has not responded yet. You can try again.")
                  : t("Waiting for the plugin's response…")}
          </p>
          {(pending.status === "failed" ||
            (pending.status === "waiting" && prolonged)) && (
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-violet-400 px-4 py-2 text-sm"
              onClick={() =>
                void pluginCommands
                  .getState()
                  .send(
                    roomId,
                    block,
                    pending.command,
                    pending.payload,
                    true
                  )
              }
            >
              {t("Try again")}
            </button>
          )}
        </div>
      )}
      {pending?.error && (
        <p role="alert" className="text-sm text-red-300">
          {pending.status === "rejected"
            ? t("Command refused: {reason}", { reason: t(pending.error) })
            : t(pending.error)}
        </p>
      )}
      {pending?.status === "rejected" && (
        <button
          type="button"
          onClick={() => pluginCommands.getState().dismiss(key)}
          className="min-h-[44px] rounded-lg border border-[#334155] px-4 py-2 text-sm"
        >
          {t("Got it")}
        </button>
      )}
    </article>
  );
}
