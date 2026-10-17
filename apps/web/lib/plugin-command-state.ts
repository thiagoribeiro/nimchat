import { t } from "@nimchat/i18n";
import { createPluginCommandStore as createStore } from "@nimchat/sdk/commands";
import { supported } from "@nimchat/brian";
export type { QueuedCommand as PendingCommand } from "@nimchat/sdk/command-queue";
export function createPluginCommandStore(
  uuid: () => string,
  now: () => number = Date.now
) {
  return createStore(uuid, now, (plugin, instance_id, view) =>
    supported({
      type: "plugin",
      plugin,
      instance_id,
      version: "1.0",
      schema_version: "1.0",
      view,
      fallback_markdown: t("Plugin state")
    })
  );
}
