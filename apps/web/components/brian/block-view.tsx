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
  referenceTarget
} from "@nimchat/brian";
import { useChatStore } from "@nimchat/sdk";
import Link from "next/link";
import type { Block, Trust } from "@nimchat/brian";
import { useEffect, useState, useMemo } from "react";
import { AgentStatus } from "@/components/brian/agent-status";
import { pluginCommands, usePluginCommands } from "@/lib/plugin-commands";
import { ApprovalView } from "./plugins/approval-view";
import { ChecklistView } from "./plugins/checklist-view";
import { CommandStatus } from "./plugins/command-status";
import { FormView } from "./plugins/form-view";
import { PollView } from "./plugins/poll-view";
import { WorkflowView } from "./plugins/workflow-view";
import type { PluginViewProps } from "./plugins/types";

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

// Shared shell of every plugin card: optimistic view, command delivery and
// status. Each plugin's body lives in ./plugins.
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
  const own = useMemo(
    () =>
      commands.filter(
        (c) =>
          c.roomId === roomId &&
          c.plugin === block.plugin &&
          c.instanceId === block.instance_id
      ),
    [commands, roomId, block.plugin, block.instance_id]
  );
  const bills = block.plugin === "monthly_bills";
  const view = useMemo(
    () => (bills ? block.view : overlayView(block.view, own)),
    [bills, block.view, own]
  );
  const blocked =
    !ready ||
    !!block.view.transfer ||
    (!!pending && !["checklist", "monthly_bills"].includes(block.plugin));
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!pending) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  const send = (command: string, payload: Record<string, unknown> = {}) => {
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
  const props: PluginViewProps = {
    view,
    userId: trust.userId,
    owner: view.owner_id === trust.userId,
    blocked,
    send,
    setNotice,
    action: (label, command, payload = {}, danger = false) => (
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
    )
  };
  const status = statusInfo(view);
  return (
    <article
      className={
        "space-y-4 rounded-xl border border-[#334155] bg-[#1A2338] " +
        (focus && bills ? "p-3" : "p-5")
      }
    >
      {!(focus && bills) && (
        <div>
          <p className="text-lg font-semibold">
            {view.title ?? view.question ?? block.plugin}
          </p>
          <p className="mt-1 text-xs text-violet-300">{status.label}</p>
        </div>
      )}
      {!bills && view.description && (
        <p className="whitespace-pre-wrap text-sm text-slate-300">
          {String(view.description)}
        </p>
      )}
      {block.plugin === "workflow" && <WorkflowView {...props} />}
      {bills && (
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
            setItem: (key, value) => window.localStorage.setItem(key, value)
          }}
          commands={own}
          result={result}
          onOpen={() =>
            router.push(
              `/rooms/${encodeURIComponent(roomId)}/surfaces/monthly_bills/${encodeURIComponent(block.instance_id)}`
            )
          }
          send={(cmd, payload, retry) =>
            pluginCommands.getState().send(roomId, block, cmd, payload, retry)
          }
        />
      )}
      {block.plugin === "approval" && <ApprovalView {...props} />}
      {block.plugin === "checklist" && <ChecklistView {...props} />}
      {block.plugin === "poll" && <PollView {...props} />}
      {block.plugin === "form_stateful" && <FormView {...props} result={result} />}
      {notice && (
        <p role="status" className="text-sm text-amber-300">
          {notice}
        </p>
      )}
      <CommandStatus instance={key} block={block} roomId={roomId} clock={clock} />
    </article>
  );
}
