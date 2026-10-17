"use client";
import { t } from "@nimchat/i18n";
import { PersonalSurfaceCreator } from "./personal-surface-creator";
import {
  surfaceSections,
  pluginLabel,
  surfaceTitle,
  statusInfo
} from "@nimchat/brian";
import type { Surface } from "@nimchat/brian";
import { ChevronRight, Pin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRoom } from "@/components/chat/room-provider";
const href = (s: Surface) =>
  "/rooms/" +
  encodeURIComponent(s.roomId) +
  "/surfaces/" +
  encodeURIComponent(s.block.plugin) +
  "/" +
  encodeURIComponent(s.block.instance_id);
export function SurfaceList() {
  const { roomId, surfaces, status } = useRoom();
  const [archived, setArchived] = useState(false);
  const groups = surfaceSections(surfaces, roomId);
  const current = [
    { label: t("Pinned"), items: groups.pinned },
    { label: t("Active"), items: groups.active },
    { label: t("Recent"), items: groups.recent }
  ];
  const sections = archived
    ? [{ label: t("Done and hidden"), items: groups.archived }]
    : current;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <PersonalSurfaceCreator roomId={roomId} />
        <div>
          <h2 className="text-xl font-semibold">
            {t("Surfaces in this conversation")}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {t("Objects and activities shared in the context of this room.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setArchived(false)}
            className={
              "rounded-xl px-4 py-2 text-sm " +
              (!archived
                ? "bg-violet-600 text-white"
                : "bg-[#1A2338] text-slate-300")
            }
          >
            {t("In use ({count})", {
              count:
                groups.active.length +
                groups.pinned.length +
                groups.recent.length,
            })}
          </button>
          <button
            type="button"
            onClick={() => setArchived(true)}
            className={
              "rounded-xl px-4 py-2 text-sm " +
              (archived
                ? "bg-violet-600 text-white"
                : "bg-[#1A2338] text-slate-300")
            }
          >
            {t("Done and hidden ({count})", { count: groups.archived.length })}
          </button>
        </div>
        {sections
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.label} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {g.label}
              </h3>
              {g.items.map((s) => {
                const st = statusInfo(s.block.view);
                return (
                  <Link
                    href={href(s)}
                    key={s.key}
                    className="flex min-h-[75px] items-center gap-3 rounded-xl border border-[#26324A] bg-[#1A2338] p-4 hover:border-violet-500/60 focus-visible:outline-violet-400"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                      {pluginLabel(s.block.plugin).slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {surfaceTitle(s)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {pluginLabel(s.block.plugin)} · {st.label}
                      </p>
                    </div>
                    {s.userPin && (
                      <Pin
                        size={15}
                        className="text-violet-300"
                        aria-label={t("status::Pinned")}
                      />
                    )}
                    <ChevronRight size={18} className="text-slate-400" />
                  </Link>
                );
              })}
            </section>
          ))}
        {!sections.some((g) => g.items.length) && (
          <p className="rounded-xl border border-dashed border-[#334155] p-8 text-center text-sm text-slate-400">
            {status === "loading"
              ? t("Loading surfaces...")
              : archived
                ? t("No done or hidden surfaces.")
                : t("No surfaces in use in this conversation.")}
          </p>
        )}
      </div>
    </div>
  );
}
