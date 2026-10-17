"use client";
import { t, timeZone } from "@nimchat/i18n";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import { getNimletClient } from "@/lib/nimlet";
import { useAuthStore, useChatStore } from "@nimchat/sdk";
import { brianTrust } from "@/lib/brian";
export function PersonalSurfaceCreator({ roomId }: { roomId: string }) {
  const user = useAuthStore((s) => s.userId) ?? "";
  const events = useChatStore((s) => s.messagesByRoom[roomId]);
  const trust = brianTrust(user);
  const integrated = events?.some(
    (e) =>
      trust.agents.has(e.sender_id) || trust.publishers.has(e.sender_id)
  );
  const [title, setTitle] = useState(t("Household bills")),
    [message, setMessage] = useState("");
  if (
    process.env.NEXT_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED !== "true" ||
    !integrated
  )
    return null;
  return (
    <details>
      <summary className="min-h-[44px] cursor-pointer text-violet-300">
        {t("Create monthly bills in this conversation")}
      </summary>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await getNimletClient().sendEvent(
              roomId,
              "m.plugin.command",
              uuid(),
              {
                plugin: "monthly_bills",
                instance_id: "create:" + uuid(),
                command: "create_personal",
                payload: { title, data: { timezone: timeZone() } }
              }
            );
            setMessage(
              t("Creation requested. Wait for the plugin to confirm it.")
            );
          } catch {
            setMessage(t("Could not request creation."));
          }
        }}
      >
        <input
          required
          maxLength={120}
          aria-label={t("Monthly bills name")}
          className="rounded bg-slate-900 p-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="min-h-[44px] text-violet-300">{t("Create")}</button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
