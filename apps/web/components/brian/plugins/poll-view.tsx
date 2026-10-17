import { t } from "@nimchat/i18n";
import type { Block } from "@nimchat/brian";
import { voteOptions } from "@/lib/form-draft";
import type { PluginViewProps } from "./types";

export function PollView({ view, userId, owner, blocked, send, setNotice, action }: PluginViewProps) {
  const selected: string[] = view.votes_by_user?.[userId] ?? [];
  return (
    <div className="space-y-2">
      {view.title && view.question && <p className="text-sm">{view.question}</p>}
      {(view.options ?? []).map((option: Block) => {
        const chosen = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={chosen}
            disabled={blocked || view.status !== "open"}
            onClick={() => {
              const next = voteOptions(selected, option.id, !!view.allow_multiple);
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
  );
}
