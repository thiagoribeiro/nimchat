import { t } from "@nimchat/i18n";
import { createPluginCommandStore } from "@nimchat/sdk/commands";
import { supported } from "@nimchat/brian";
import { useStore } from "zustand";
import { v4 as uuid } from "uuid";
import { loadBrianCache } from "./brian-cache";
import { File, Paths } from "expo-file-system";
export const commandStorage = {
  getItem: (key: string) => {
    if (key.startsWith("nimchat:pending:v1:")) {
      const user = decodeURIComponent(key.slice("nimchat:pending:v1:".length));
      const pending = loadBrianCache(user).pending ?? {};
      return JSON.stringify(
        Object.fromEntries(
          Object.entries(pending).map(([key, c]) => {
            const [roomId, plugin, instanceId] = JSON.parse(key);
            return [key, { ...c, roomId, plugin, instanceId }];
          }),
        ),
      );
    }
    const f = new File(Paths.document, encodeURIComponent(key) + ".json");
    return f.exists ? f.textSync() : null;
  },
  setItem: (key: string, value: string) => {
    const f = new File(Paths.document, encodeURIComponent(key) + ".json");
    if (!f.exists) f.create();
    f.write(value);
  },
};
export const pluginCommands = createPluginCommandStore(
  uuid,
  Date.now,
  (plugin, instance_id, view) =>
    supported({
      type: "plugin",
      plugin,
      instance_id,
      version: "1.0",
      schema_version: "1.0",
      view,
      fallback_markdown: t("Plugin state"),
    }),
);
export function usePluginCommands<T>(
  selector: (s: ReturnType<typeof pluginCommands.getState>) => T,
) {
  return useStore(pluginCommands, selector);
}
