import { t } from "@nimchat/i18n";
import type { Block } from "@nimchat/brian";
import type { PluginViewProps } from "./types";

export function WorkflowView({ view, action }: PluginViewProps) {
  return (
    <div className="space-y-2">
      {(view.steps ?? []).map((step: Block, i: number) => (
        <div
          key={step.id ?? i}
          className="rounded-lg bg-[#0F172A] p-3 text-sm"
        >
          <span className="text-violet-300">{i + 1}. </span>
          {step.title}{" "}
          <span className="text-slate-400">· {step.status}</span>
        </div>
      ))}
      {view.summary && (
        <p className="whitespace-pre-wrap text-sm">{view.summary}</p>
      )}
      {view.failure_description && (
        <p role="alert" className="text-sm text-red-300">
          {view.failure_description}
        </p>
      )}
      {action(t("Refresh"), "refresh")}
    </div>
  );
}
