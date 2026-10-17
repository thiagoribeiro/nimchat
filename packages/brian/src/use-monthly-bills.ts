import { t } from "@nimchat/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { canEdit } from "./interaction.ts";
import {
  billAmountInput,
  billGroup,
  billSummary,
  billToday,
  groupBills,
  otherBillGroup,
  parseBRL,
  reconcileBillAmountInput,
  shiftBillMonth,
  validBillDate,
} from "./monthly-bills.ts";
import type { BillFilter } from "./monthly-bills.ts";

type Data = Record<string, any>;
export type BillPanel =
  | "bill"
  | "new"
  | "edit"
  | "month"
  | "manage"
  | "options"
  | null;
export interface BillsProps {
  view: Data;
  user: string;
  focus?: boolean;
  onOpen?: () => void;
  preferenceKey: string;
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  commands: readonly Data[];
  result?: { txn?: string; revision: number };
  send(
    command: string,
    payload?: Data,
    retry?: boolean,
  ): Promise<string | undefined>;
}
export function useMonthlyBills(props: BillsProps) {
  const { view, user, storage, preferenceKey, commands, result, send } = props;
  const today = billToday(view.timezone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [filter, setFilter] = useState<BillFilter>("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [panel, setPanel] = useState<BillPanel>(null);
  const [itemId, setItemId] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    day: "10",
    group: t("Other"),
    value: "",
    paidOn: today,
    note: "",
  });
  const [noteOpen, setNoteOpen] = useState(false);
  const [danger, setDanger] = useState<"cancel_entry" | "archive_bill" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [activeTxn, setActiveTxn] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const intent = useRef<
    { command: string; payload: Data; close: boolean; panel: BillPanel } | undefined
  >(undefined);
  const attemptedMonth = useRef(new Set<string>());
  const amountBefore = useRef("");
  const editable =
    canEdit(view, user) && view.status === "open" && !view.transfer;
  const items = view.items ?? [];
  const entries = Object.values(view.periods?.[month]?.entries ?? {}) as Data[];
  const groups = useMemo(
    () => groupBills(view, month, filter, today),
    [view, month, filter, today],
  );
  const totals = useMemo(
    () => billSummary(entries, today),
    [view, month, today],
  );
  const entry = entries.find((e) => e.item_id === itemId);
  const item = items.find((i: Data) => i.id === itemId);
  const pending = commands.find((c) => c.txn === activeTxn);
  const otherPending = commands.some(
    (c) => c.txn !== activeTxn && c.status !== "rejected",
  );
  const busy =
    submitting ||
    (!!pending && ["queued", "sending", "waiting"].includes(pending.status));
  const uncertain = pending?.status === "failed";
  const cents = parseBRL(draft.value);
  useEffect(() => {
    try {
      setExpanded(JSON.parse(storage.getItem(preferenceKey) ?? "null"));
    } catch {
      setExpanded(null);
    }
  }, [preferenceKey]);
  const toggleGroup = (name: string) => {
    const next = expanded === name ? null : name;
    setExpanded(next);
    try {
      storage.setItem(preferenceKey, JSON.stringify(next));
    } catch {
      /* Preferences never prevent a command. */
    }
  };
  useEffect(() => {
    if (
      activeTxn &&
      result?.txn === activeTxn &&
      view.revision >= result.revision
    ) {
      if (intent.current?.close) {
        setPanel(null);
        setDanger(null);
      }
      intent.current = undefined;
      lock.current = false;
      setSubmitting(false);
      setActiveTxn(undefined);
      setError("");
    }
  }, [activeTxn, result, view.revision]);
  useEffect(() => {
    if (pending && ["failed", "rejected"].includes(pending.status)) {
      lock.current = false;
      setSubmitting(false);
      setError(pending.error || t("The record is not confirmed yet."));
    }
  }, [pending?.status, pending?.error]);
  const serverAmount = entry ? billAmountInput(entry) : "";
  useEffect(() => {
    if (panel === "bill") {
      const previous = amountBefore.current;
      setDraft((d) => ({
        ...d,
        value: reconcileBillAmountInput(d.value, previous, serverAmount),
      }));
      amountBefore.current = serverAmount;
    }
  }, [serverAmount]);
  const submit = async (command: string, payload: Data, close = true) => {
    if (lock.current || busy || otherPending || uncertain || !editable) return;
    lock.current = true;
    setSubmitting(true);
    setError("");
    intent.current = { command, payload, close, panel };
    try {
      const txn = await send(command, payload);
      if (!txn) throw new Error(t("Could not prepare the command."));
      setActiveTxn(txn);
      setSubmitting(false);
    } catch (e) {
      lock.current = false;
      setSubmitting(false);
      setError(e instanceof Error ? e.message : t("Could not save."));
    }
  };
  useEffect(() => {
    if (
      props.focus === false ||
      !editable ||
      view.periods?.[month] ||
      commands.some((c) => c.status !== "rejected") ||
      attemptedMonth.current.has(month)
    )
      return;
    attemptedMonth.current.add(month);
    void submit("open_period", { period: month }, false);
  }, [month, editable, !!view.periods?.[month], props.focus]);
  const retry = async () => {
    if (!intent.current || lock.current) return;
    lock.current = true;
    setSubmitting(true);
    setError("");
    try {
      await send(intent.current.command, intent.current.payload, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Failed to resend."));
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };
  const open = (kind: BillPanel, id = "") => {
    if (busy) return;
    // A failed transport may already have delivered the command. Keep its form
    // attached to the original intent until the authenticated receipt arrives.
    if (uncertain) {
      setPanel(intent.current?.panel ?? "options");
      return;
    }
    const selected = entries.find((e) => e.item_id === id);
    const recurrence = items.find((i: Data) => i.id === id);
    setItemId(id);
    setPanel(kind);
    setDanger(null);
    setError("");
    setNoteOpen(false);
    const value = selected ? billAmountInput(selected) : "";
    amountBefore.current = value;
    setDraft({
      name: recurrence?.name ?? selected?.name ?? "",
      day: String(recurrence?.due_day ?? 10),
      group: billGroup(recurrence),
      value,
      paidOn: selected?.paid_on ?? today,
      note: selected?.note ?? "",
    });
  };
  const close = () => {
    if (!busy) {
      setPanel(null);
      setDanger(null);
    }
  };
  const changeMonth = (next: string) => {
    if (!busy && !uncertain) {
      setMonth(next);
      setPanel(null);
    }
  };
  const edit = (field: keyof typeof draft, value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));
  const canSave = editable && !busy && !otherPending && !uncertain;
  const saveRecurrence = (id: string) =>
    submit(panel === "new" ? "add_bill" : "update_bill", {
      item_id: id,
      name: draft.name.trim(),
      due_day: Number(draft.day),
      group:
        draft.group.trim() === otherBillGroup() ? null : draft.group.trim() || null,
    });
  const register = () => {
    if (
      cents == null ||
      !validBillDate(draft.paidOn) ||
      entry?.status !== "pending"
    )
      return;
    void submit("record_payment", {
      period: month,
      item_id: itemId,
      amount_minor: cents,
      paid_on: draft.paidOn,
      note: draft.note,
      confirmed: true,
    });
  };
  const saveValue = () => {
    if (cents != null && entry?.status === "pending")
      void submit("confirm_amount", {
        period: month,
        item_id: itemId,
        amount_minor: cents,
      });
  };
  const confirmDanger = () => {
    if (danger)
      void submit(danger, {
        item_id: itemId,
        ...(danger === "cancel_entry" ? { period: month } : {}),
      });
  };
  return {
    today,
    month,
    filter,
    setFilter,
    expanded,
    toggleGroup,
    panel,
    open,
    close,
    changeMonth,
    shiftMonth: (n: number) => changeMonth(shiftBillMonth(month, n)),
    groups,
    totals,
    entries,
    items,
    editable,
    entry,
    item,
    draft,
    edit,
    noteOpen,
    setNoteOpen,
    danger,
    setDanger,
    error,
    busy,
    uncertain,
    pending,
    canSave,
    cents,
    saveRecurrence,
    register,
    saveValue,
    confirmDanger,
    retry,
    monthExists: !!view.periods?.[month],
  };
}
