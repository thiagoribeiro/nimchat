import { t } from "@nimchat/i18n";
import { useEffect, useRef, useState } from "react";
import { formInputValue } from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import { formValues, reconcileDraft } from "@/lib/form-draft";
import type { FormDraft } from "@/lib/form-draft";
import type { CommandResult } from "@nimchat/sdk/commands";
import type { PluginViewProps } from "./types";

// Local draft of a stateful form. Authoritative snapshots reconcile untouched
// fields; the user's own acknowledged result clears the dirty marks.
export function FormView({
  view,
  owner,
  blocked,
  send,
  action,
  result
}: PluginViewProps & { result?: CommandResult }) {
  const terminal = ["submitted", "cancelled"].includes(view.status);
  const [draft, setDraft] = useState<FormDraft>(() => ({
    values: formValues(view),
    dirty: {}
  }));
  const acknowledged = useRef<string | undefined>(undefined);
  useEffect(() => {
    const own =
      !!result &&
      result.eventId !== acknowledged.current &&
      view.revision >= result.revision;
    if (own) acknowledged.current = result.eventId;
    setDraft((current) => reconcileDraft(current, view, own));
  }, [view, result]);
  const change = (id: string, value: unknown) =>
    setDraft((current) => ({
      values: { ...current.values, [id]: value },
      dirty: { ...current.dirty, [id]: true }
    }));
  const disabled = !owner || blocked || terminal;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (owner && !terminal && !blocked) send("submit", { values: draft.values });
      }}
    >
      {(view.fields ?? []).map((field: Block) => (
        <label key={field.id} className="block space-y-1 text-sm">
          <span>
            {field.label}
            {field.required ? " *" : ""}
          </span>
          {field.type === "boolean" ? (
            <select
              aria-label={field.label}
              disabled={disabled}
              required={!!field.required}
              value={
                draft.values[field.id] === undefined
                  ? ""
                  : String(draft.values[field.id])
              }
              className="block min-h-[44px] w-full rounded-lg bg-[#0F172A] p-3"
              onChange={(e) =>
                change(
                  field.id,
                  e.target.value === "" ? undefined : e.target.value === "true"
                )
              }
            >
              <option value="">{t("Select")}</option>
              <option value="true">{t("Yes")}</option>
              <option value="false">{t("No")}</option>
            </select>
          ) : field.type === "select" ? (
            <select
              disabled={disabled}
              required={!!field.required}
              className="block w-full rounded-lg bg-[#0F172A] p-3"
              value={String(draft.values[field.id] ?? "")}
              onChange={(e) => change(field.id, e.target.value)}
            >
              <option value="">{t("Select")}</option>
              {(field.options ?? []).map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              disabled={disabled}
              type={
                field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : "text"
              }
              required={!!field.required}
              step={field.type === "number" ? "any" : undefined}
              className="block min-h-[44px] w-full rounded-lg bg-[#0F172A] p-3"
              value={String(draft.values[field.id] ?? "")}
              onChange={(e) =>
                change(field.id, formInputValue(field.type, e.target.value))
              }
            />
          )}
          {view.errors?.[field.id] && (
            <span className="block text-red-300">{t(view.errors[field.id])}</span>
          )}
        </label>
      ))}
      {owner && !terminal && (
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={blocked}
            className="min-h-[44px] rounded-lg bg-violet-600 px-4 py-3 text-sm disabled:opacity-50"
          >
            {t("Submit form")}
          </button>
          {action(t("Save"), "save", { values: draft.values })}
          {action(t("Cancel"), "cancel", {}, true)}
        </div>
      )}
    </form>
  );
}
