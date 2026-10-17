"use client";
import { t, timeZone } from "@nimchat/i18n";
import {
  project,
  isSharedRoom,
  pluginLabel,
  statusInfo
} from "@nimchat/brian";
import { useAuthStore, useChatStore, loadSharedSurfaceHistory } from "@nimchat/sdk";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { v4 as uuid } from "uuid";
import { brianTrust } from "@/lib/brian";
import { getNimletClient } from "@/lib/nimlet";
export function SharedSurfaces() {
  const rooms = useChatStore((s) => s.rooms),
    events = useChatStore((s) => s.messagesByRoom),
    user = useAuthStore((s) => s.userId) ?? "";
  const [origin, setOrigin] = useState(""),
    [title, setTitle] = useState(""),
    [people, setPeople] = useState(""),
    [items, setItems] = useState(""),
    [plugin, setPlugin] = useState("checklist"),
    [error, setError] = useState("");
  const list = useMemo(
    () =>
      Object.values(rooms).filter(
        (r) => r.state === "join" && isSharedRoom(r.name)
      ),
    [rooms]
  );
  const trust = useMemo(() => brianTrust(user), [user]);
  const roomKey = JSON.stringify(list.map((r) => [r.room_id, r.name]).sort());
  const [attempt, setAttempt] = useState(0);
  const [historyStatus, setHistoryStatus] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    setError("");
    void Promise.allSettled(list.map(async (r) => {
      const ready = () => [...project(useChatStore.getState().messagesByRoom[r.room_id] ?? [], trust).values()].filter((s) =>
        s.block.view.shared?.room_id === r.room_id &&
        `#shared-surface:${s.block.view.shared.id}#`.toLowerCase() === r.name.toLowerCase()).length === 1;
      if (ready()) return;
      setHistoryStatus((s) => ({ ...s, [r.room_id]: "loading" }));
      try {
        const result = await loadSharedSurfaceHistory({
          roomId: r.room_id,
          load: (id, opts) => getNimletClient().getMessages(id, opts),
          ready,
          canRead: () => live && useChatStore.getState().rooms[r.room_id]?.state === "join",
          apply: (events) => useChatStore.getState().setInitialMessages(r.room_id, events),
        });
        if (live) setHistoryStatus((s) => ({ ...s, [r.room_id]: result }));
      } catch {
        if (live) setHistoryStatus((s) => ({ ...s, [r.room_id]: "error" }));
      }
    }));
    return () => { live = false; };
  }, [roomKey, user, attempt]);
  const create = async () => {
    setError("");
    if (!origin || !title.trim()) return;
    try {
      await getNimletClient().sendEvent(
        origin,
        "m.plugin.command",
        uuid(),
        {
          plugin,
          instance_id: "create:" + uuid(),
          command: "create_shared",
          payload: {
            title: title.trim(),
            data:
              plugin === "checklist"
                ? {
                    items: items
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((label) => ({ id: uuid(), label }))
                  }
                : { timezone: timeZone() },
            invitees: people
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          }
        }
      );
      setTitle("");
      setItems("");
      setError(
        t("Creation requested. The surface will appear once the plugin confirms it.")
      );
    } catch {
      setError(t("Could not request creation."));
    }
  };
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{t("Surfaces")}</h2>
      {list.map((r) => {
        const surfaces = [
          ...project(events[r.room_id] ?? [], trust).values()
        ].filter(
          (s) =>
            s.block.view.shared?.room_id === r.room_id &&
            `#shared-surface:${s.block.view.shared.id}#`.toLowerCase() ===
              r.name.toLowerCase()
        );
        return (
          <Link
            key={r.room_id}
            href={"/shared/" + encodeURIComponent(r.room_id)}
            className="block rounded-xl border border-slate-700 p-3 text-sm"
          >
            <strong>
              {surfaces.length === 1
                ? surfaces[0].title
                : historyStatus[r.room_id] === "error" ? t("Failed to load surface") : historyStatus[r.room_id] === "missing" ? t("Waiting for the surface to be published") : t("Loading surface…")}
            </strong>
            {surfaces.length === 1 && (
              <p className="text-xs text-slate-400">
                {pluginLabel(surfaces[0].block.plugin)} ·{" "}
                {statusInfo(surfaces[0].block.view).label} ·{" "}
                {(surfaces[0].block.view.shared.participants ?? [])
                  .filter((p: any) => p.state !== "leave")
                  .map((p: any) => p.username)
                  .join(", ")}
              </p>
            )}
          </Link>
        );
      })}
      {list.some((r) => ["error", "missing"].includes(historyStatus[r.room_id])) && (
        <button className="min-h-[44px] text-violet-300" onClick={() => setAttempt((n) => n + 1)}>{t("Try loading again")}</button>
      )}
      {!list.length && (
        <p className="text-sm text-slate-400">
          {t("No shared surfaces.")}
        </p>
      )}
      {process.env.NEXT_PUBLIC_BRIAN_SHARING_ENABLED === "true" && (
        <details>
          <summary className="min-h-[44px] cursor-pointer text-sm text-violet-300">
            {t("Create shared surface")}
          </summary>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <select
              aria-label={t("Original conversation with Brian")}
              required
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-slate-900 p-2"
            >
              <option value="">{t("Original conversation with Brian")}</option>
              {Object.values(rooms)
                .filter(
                  (r) =>
                    r.state === "join" &&
                    !isSharedRoom(r.name) &&
                    (events[r.room_id] ?? []).some(
                      (e) =>
                        trust.agents.has(e.sender_id) ||
                        trust.publishers.has(e.sender_id)
                    )
                )
                .map((r) => (
                  <option key={r.room_id} value={r.room_id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-400">
              {t("Every human participant in this conversation will be invited.")}
            </p>
            <select
              aria-label={t("Surface type")}
              value={plugin}
              onChange={(e) => setPlugin(e.target.value)}
              className="w-full bg-slate-900 p-2"
            >
              <option value="checklist">Checklist</option>
              {process.env.NEXT_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED ===
                "true" && (
                <option value="monthly_bills">{t("Monthly bills")}</option>
              )}
            </select>
            <input
              required
              maxLength={120}
              aria-label={t("New surface name")}
              placeholder={t("Name")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 p-2"
            />
            <input
              aria-label={t("Additional guests")}
              placeholder={t("Additional people, comma-separated")}
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              className="w-full bg-slate-900 p-2"
            />
            {plugin === "checklist" && (
              <textarea
                required
                aria-label={t("Checklist items")}
                placeholder={t("One item per line")}
                value={items}
                onChange={(e) => setItems(e.target.value)}
                className="w-full bg-slate-900 p-2"
              />
            )}
            <button className="min-h-[44px] text-violet-300">{t("Create")}</button>
          </form>
        </details>
      )}
      {error && (
        <p role="status" className="text-sm text-amber-300">
          {error}
        </p>
      )}
    </section>
  );
}
