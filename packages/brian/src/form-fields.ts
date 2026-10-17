import type { Block } from "./index.ts";

export interface FormDraft { values: Record<string, unknown>; dirty: Record<string, boolean>; }
export function formValues(view: Block): Record<string, unknown> {
  return Object.fromEntries((view.fields ?? []).flatMap((field: Block) => {
    const value = view.values?.[field.id];
    // A boolean has three input states: unanswered, yes and no.
    return value === undefined && field.type === "boolean" ? [] : [[field.id, value ?? ""]];
  }));
}
export function reconcileDraft(draft: FormDraft, view: Block, acknowledged: boolean): FormDraft {
  const values = formValues(view);
  if (acknowledged) return { values, dirty: {} };
  const dirty: Record<string, boolean> = {};
  for (const field of view.fields ?? []) if (draft.dirty[field.id]) {
    values[field.id] = draft.values[field.id]; dirty[field.id] = true;
  }
  return { values, dirty };
}
export function formInputValue(type: string, text: string): unknown {
  if (type !== "number" || !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text.trim())) return text;
  const number = Number(text.trim().replace(",", "."));
  return Number.isFinite(number) ? number : text;
}
export function formQuestion(block: Block): { question_id: string; request_event_id: string } | undefined {
  const q = block.plugin === "form_stateful" ? block.metadata?.agent_question : undefined;
  return q && typeof q.question_id === "string" && typeof q.request_event_id === "string" ? q : undefined;
}
