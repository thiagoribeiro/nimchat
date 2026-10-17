import { t } from "@nimchat/i18n";
import { canEdit } from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import type { PluginViewProps } from "./types";

export function ChecklistView({ view, userId, owner, blocked, send, action }: PluginViewProps) {
  return (
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
              !canEdit(view, userId) ||
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
  );
}
