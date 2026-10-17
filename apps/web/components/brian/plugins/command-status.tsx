import { t } from "@nimchat/i18n";
import type { Block } from "@nimchat/brian";
import { pluginCommands, usePluginCommands } from "@/lib/plugin-commands";

// Delivery state of the instance's in-flight command: waiting, failed and
// retryable, or refused by the plugin.
export function CommandStatus({
  instance,
  block,
  roomId,
  clock
}: {
  instance: string;
  block: Block;
  roomId: string;
  clock: number;
}) {
  const pending = usePluginCommands((s) => s.pending[instance]);
  if (!pending) return null;
  const prolonged = clock - pending.startedAt >= 30000;
  return (
    <>
      {pending.status !== "rejected" && (
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
                  .send(roomId, block, pending.command, pending.payload, true)
              }
            >
              {t("Try again")}
            </button>
          )}
        </div>
      )}
      {pending.error && (
        <p role="alert" className="text-sm text-red-300">
          {pending.status === "rejected"
            ? t("Command refused: {reason}", { reason: t(pending.error) })
            : t(pending.error)}
        </p>
      )}
      {pending.status === "rejected" && (
        <button
          type="button"
          onClick={() => pluginCommands.getState().dismiss(instance)}
          className="min-h-[44px] rounded-lg border border-[#334155] px-4 py-2 text-sm"
        >
          {t("Got it")}
        </button>
      )}
    </>
  );
}
