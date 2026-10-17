import { test } from "node:test";
import assert from "node:assert/strict";
import { formValues, reconcileDraft, voteOptions } from "../lib/form-draft.ts";

const fields = [{ id: "name", type: "text" }, { id: "active", type: "boolean" }, { id: "count", type: "number" }, { id: "city", type: "text" }, { id: "optional", type: "text" }];
const view = { fields, values: { name: "Maria", active: false, count: 0, city: "Recife", optional: "" } };
test("full form payload preserves untouched fields, false, zero and empty text", () => {
  const draft = { values: { ...formValues(view), city: "Natal" }, dirty: { city: true } };
  assert.deepEqual(draft.values, { name: "Maria", active: false, count: 0, city: "Natal", optional: "" });
  assert.equal(formValues({ ...view, values: { active: true } }).active, true);
});
test("unrelated snapshots refresh untouched fields without overwriting the draft", () => {
  const draft = { values: { ...formValues(view), city: "Natal" }, dirty: { city: true } };
  const next = reconcileDraft(draft, { ...view, values: { ...view.values, name: "Ana", city: "Salvador" } }, false);
  assert.equal(next.values.name, "Ana"); assert.equal(next.values.city, "Natal"); assert.deepEqual(next.dirty, { city: true });
});
test("own acknowledgement adopts authoritative values and removes stale fields", () => {
  const draft = { values: { ...formValues(view), city: "Natal", removed: "old" }, dirty: { city: true, removed: true } };
  const next = reconcileDraft(draft, { ...view, values: { ...view.values, city: "Natal validado" } }, true);
  assert.equal(next.values.city, "Natal validado"); assert.equal(next.values.removed, undefined); assert.deepEqual(next.dirty, {});
});
test("multi-vote cannot remove the last selection and can change several choices", () => {
  const selected = ["a"]; assert.equal(voteOptions(selected, "a", true), selected);
  assert.deepEqual(voteOptions(selected, "b", true), ["a", "b"]);
  assert.deepEqual(voteOptions(["a", "b"], "a", true), ["b"]);
  assert.deepEqual(voteOptions(["a"], "b", false), ["b"]);
});
