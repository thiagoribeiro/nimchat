import { t } from "@nimchat/i18n";
import type { PluginViewProps } from "./types";

export function ApprovalView({ view, owner, action }: PluginViewProps) {
  const expired = !!view.expires_at && Date.parse(view.expires_at) <= Date.now();
  return (
    <div className="flex flex-wrap gap-2">
      {view.status === "pending" && owner && !expired ? (
        <>
          {action(t("Approve"), "approve")}
          {action(t("Reject"), "reject", {}, true)}
          {action(t("Cancel"), "cancel", {}, true)}
        </>
      ) : (
        <p className="text-sm text-slate-400">
          {owner ? t("Approval is not pending.") : t("Waiting for the owner.")}
        </p>
      )}
    </div>
  );
}
