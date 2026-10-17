"use client";
import { t, locale } from "@nimchat/i18n";
import { useChatStore } from "@nimchat/sdk";

import { useEffect, useState } from "react";
import {
  instanceKey,
  statusStale,
  statusDuration
} from "@nimchat/brian";
import type { Block } from "@nimchat/brian";

export function AgentStatus({
  block,
  roomId,
  userId
}: {
  block: Block;
  roomId: string;
  userId: string;
}) {
  const key =
    "brian-expanded:" +
    JSON.stringify([
      userId,
      instanceKey(roomId, block.plugin, block.instance_id)
    ]);
  const [expanded, setExpanded] = useState(false);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const read = () => {
      try {
        setExpanded(localStorage.getItem(key) === "true");
      } catch {}
    };
    read();
    window.addEventListener("brian-expanded", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("brian-expanded", read);
      window.removeEventListener("storage", read);
    };
  }, [key]);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const toggle = () => {
    const value = !expanded;
    setExpanded(value);
    try {
      localStorage.setItem(key, String(value));
      window.dispatchEvent(new Event("brian-expanded"));
    } catch {}
  };
  const v = block.view,
    stale = statusStale(v, clock),
    count = Math.max(0, v.active_activities.length - 1);
  return (
    <section className="border rounded-lg p-3 text-sm">
      <button
        type="button"
        aria-label={
          expanded
            ? t("Collapse agent activity")
            : t("Expand agent activity")
        }
        aria-expanded={expanded}
        onClick={toggle}
        className="w-full flex items-center gap-2 text-left"
      >
        <span
          aria-hidden
          className={
            v.status === "running" && !stale ? "animate-spin" : ""
          }
        >
          {v.status === "running" && !stale
            ? "◌"
            : v.status === "completed"
              ? "✓"
              : v.status === "failed"
                ? "!"
                : "·"}
        </span>
        <span className="flex-1">
          {v.current_status}
          {count ? t(" (+{count} activities)", { count }) : ""}
        </span>
        <span aria-hidden>{expanded ? "▴" : "▾"}</span>
      </button>
      {v.status === "waiting_user" && v.owner_id === userId && (
        <button
          type="button"
          className="min-h-[44px] text-violet-300"
          onClick={() =>
            useChatStore.getState().setContinuation(roomId, v.request_id)
          }
        >
          {t("Reply to this request")}
        </button>
      )}
      {stale && (
        <p className="text-amber-600 mt-2">{t("No recent update")}</p>
      )}
      {expanded && (
        <div className="mt-3 space-y-2">
          <p>
            {t("Time:")} {statusDuration(v.started_at, v.finished_at, clock)}
          </p>
          {v.history_total > v.history.length && (
            <p>
              {t("Latest {shown} of {total} steps", { shown: v.history.length, total: v.history_total })}
            </p>
          )}
          <ol className="space-y-2">
            {v.history.map((entry: Block) => (
              <li key={entry.id} className="border-l-2 pl-2">
                <p>
                  {entry.label} ·{" "}
                  {entry.status === "running"
                    ? t("in progress")
                    : entry.status === "failed"
                      ? "falhou"
                      : entry.status === "interrupted"
                        ? "interrompido"
                        : t("done")}
                </p>
                <p className="text-xs opacity-70">
                  {new Date(entry.started_at).toLocaleTimeString(locale(), {
                  })}{" "}
                  ·{" "}
                  {statusDuration(
                    entry.started_at,
                    entry.finished_at,
                    clock
                  )}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
