export { formValues, reconcileDraft } from "../../../packages/brian/src/form-fields.ts";
export type { FormDraft } from "../../../packages/brian/src/form-fields.ts";

export function voteOptions(selected: string[], option: string, multiple: boolean): string[] {
  if (!multiple) return [option];
  const next = selected.includes(option) ? selected.filter((id) => id !== option) : [...selected, option];
  return next.length ? next : selected;
}
