// Application-owned plugin validation. Canonical BRIAN schemas/catalog are unchanged.
import { locale, t, tn } from "@nimchat/i18n";

type ObjectValue = Record<string, any>;
const object = (x: unknown): x is ObjectValue =>
  !!x && typeof x === "object" && !Array.isArray(x);
const money = (x: unknown) =>
  x === null || (Number.isSafeInteger(x) && Number(x) >= 0);
export function validMonthlyBills(v: unknown): boolean {
  if (
    !object(v) ||
    typeof v.title !== "string" ||
    typeof v.owner_id !== "string" ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 1 ||
    !["open", "archived"].includes(v.status) ||
    v.currency !== "BRL" ||
    typeof v.timezone !== "string" ||
    typeof v.selected_period !== "string" ||
    !Array.isArray(v.items) ||
    v.items.length > 100 ||
    !object(v.periods) ||
    Object.keys(v.periods).length > 1200
  )
    return false;
  for (const it of v.items)
    if (
      !object(it) ||
      typeof it.id !== "string" ||
      typeof it.name !== "string" ||
      !Number.isInteger(it.due_day) ||
      it.due_day < 1 ||
      it.due_day > 31 ||
      typeof it.active !== "boolean" ||
      (it.group != null &&
        (typeof it.group !== "string" || it.group.length > 80))
    )
      return false;
  for (const [month, p] of Object.entries(v.periods)) {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      !object(p) ||
      !object(p.entries) ||
      Object.keys(p.entries).length > 100
    )
      return false;
    for (const e of Object.values(p.entries))
      if (
        !object(e) ||
        typeof e.item_id !== "string" ||
        typeof e.name !== "string" ||
        typeof e.due_date !== "string" ||
        !["pending", "paid", "cancelled"].includes(e.status) ||
        !money(e.suggested_amount_minor) ||
        !money(e.confirmed_amount_minor) ||
        (e.status === "paid" &&
          (!money(e.paid_amount_minor) ||
            e.paid_amount_minor == null ||
            typeof e.paid_by !== "string" ||
            typeof e.paid_at !== "string"))
      )
        return false;
  }
  return true;
}
export const brl = (amount: number | bigint | null | undefined) => {
  if (amount == null) return "—";
  const cents = BigInt(amount);
  // Hermes Intl.NumberFormat cannot format BigInt. Keep the integer cents
  // exact, including aggregated totals above Number.MAX_SAFE_INTEGER.
  const negative = cents < BigInt(0);
  const digits = (negative ? -cents : cents).toString().padStart(3, "0");
  const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$\u00a0${whole},${digits.slice(-2)}`;
};
const addMoney = (a: number | bigint, b: number): number | bigint => {
  const sum = BigInt(a) + BigInt(b);
  return sum <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(sum) : sum;
};
export function parseBRL(input: string): number | undefined {
  const text = input.trim().replace(/^R\$\s*/, "");
  if (!/^(\d+|\d{1,3}(\.\d{3})+)(,\d{1,2})?$/.test(text)) return;
  const [major, fraction = ""] = text.replaceAll(".", "").split(",");
  const value = Number(major) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : undefined;
}
export function billTotals(entries: ObjectValue[], today: string) {
  return entries.reduce<{
    suggested: number | bigint;
    confirmed: number | bigint;
    paid: number | bigint;
    pending: number;
    overdue: number;
  }>(
    (sum, e) => ({
      suggested: addMoney(
        sum.suggested,
        e.status !== "cancelled"
          ? (e.confirmed_amount_minor ?? e.suggested_amount_minor ?? 0)
          : 0,
      ),
      confirmed: addMoney(
        sum.confirmed,
        e.status !== "cancelled" ? (e.confirmed_amount_minor ?? 0) : 0,
      ),
      paid: addMoney(
        sum.paid,
        e.status === "paid" ? (e.paid_amount_minor ?? 0) : 0,
      ),
      pending: sum.pending + (e.status === "pending" ? 1 : 0),
      overdue:
        sum.overdue + (e.status === "pending" && e.due_date < today ? 1 : 0),
    }),
    { suggested: 0, confirmed: 0, paid: 0, pending: 0, overdue: 0 },
  );
}

export function billAmountInput(entry: ObjectValue): string {
  const amount = entry.confirmed_amount_minor ?? entry.suggested_amount_minor;
  return amount == null ? "" : brl(amount).replace(/^R\$\s*/, "");
}
// Remote confirmations update pristine inputs. Unsaved local edits stay intact;
// an acknowledgement of the same amount also normalizes its decimal display.
export function reconcileBillAmountInput(
  draft: string,
  previous: string,
  incoming: string,
): string {
  const amount = parseBRL(incoming);
  return draft === previous ||
    (amount !== undefined && parseBRL(draft) === amount)
    ? incoming
    : draft;
}

export type BillFilter = "pending" | "paid" | "all";
// Bills without a group are listed last, under this label.
export const otherBillGroup = (): string => t("Other");
export const billGroup = (item?: ObjectValue): string =>
  item?.group?.trim() || otherBillGroup();
export const billToday = (timezone: string, date = new Date()): string =>
  date.toLocaleDateString("sv-SE", { timeZone: timezone });
export function shiftBillMonth(month: string, delta: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}
export function billMonthLabel(month: string): string {
  return new Date(month + "-15T12:00:00Z").toLocaleDateString(locale(), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
/** A YYYY-MM-DD bill date in the active locale (dd/mm/yyyy in pt-BR). */
export function billDateLabel(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString(locale(), {
    timeZone: "UTC",
  });
}
export function billMonthName(month: string): string {
  return new Date(month + "-15T12:00:00Z").toLocaleDateString(locale(), {
    month: "long",
    timeZone: "UTC",
  });
}
export function validBillDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function billSummary(entries: ObjectValue[], today: string) {
  let open: number | bigint = 0,
    paid: number | bigint = 0;
  let pending = 0,
    overdue = 0,
    unknown = 0,
    estimated = 0;
  for (const entry of entries) {
    if (entry.status === "paid")
      paid = addMoney(paid, entry.paid_amount_minor ?? 0);
    if (entry.status !== "pending") continue;
    pending++;
    if (entry.due_date < today) overdue++;
    const amount = entry.confirmed_amount_minor ?? entry.suggested_amount_minor;
    if (amount == null) unknown++;
    else open = addMoney(open, amount);
    if (
      entry.confirmed_amount_minor == null &&
      entry.suggested_amount_minor != null
    )
      estimated++;
  }
  return { open, paid, pending, overdue, unknown, estimated };
}
export function billOpenLabel(total: ReturnType<typeof billSummary>): string {
  if (total.pending > 0 && total.unknown === total.pending)
    return t("{count} without amount", { count: total.unknown });
  const amount = (total.estimated ? "≈ " : "") + brl(total.open);
  return total.unknown
    ? t("{amount} + {count} without amount", { amount, count: total.unknown })
    : amount;
}
export function groupBills(
  view: ObjectValue,
  month: string,
  filter: BillFilter,
  today: string,
) {
  const items = new Map<string, ObjectValue>(
    (view.items ?? []).map((item: ObjectValue) => [item.id, item]),
  );
  const entries = Object.values(
    view.periods?.[month]?.entries ?? {},
  ) as ObjectValue[];
  const other = otherBillGroup();
  const labels = new Set<string>();
  for (const item of items.values()) labels.add(billGroup(item));
  const order = [
    ...[...labels]
      .filter((g) => g !== other)
      .sort((a, b) => a.localeCompare(b, locale())),
    other,
  ];
  const groups = order.map((name) => ({
    name,
    entries: [] as ObjectValue[],
    all: [] as ObjectValue[],
  }));
  const byName = new Map(groups.map((g) => [g.name, g]));
  for (const entry of entries) {
    const group = byName.get(billGroup(items.get(entry.item_id)))!;
    group.all.push(entry);
    if (filter === "all" || entry.status === filter) group.entries.push(entry);
  }
  for (const group of groups)
    group.entries.sort((a, b) => {
      const priority = (e: ObjectValue) =>
        e.status === "pending" && e.due_date < today
          ? 0
          : e.status === "pending"
            ? 1
            : e.status === "paid"
              ? 2
              : 3;
      return (
        priority(a) - priority(b) ||
        a.due_date.localeCompare(b.due_date) ||
        a.name.localeCompare(b.name, locale())
      );
    });
  return groups.map((g) => {
    const totals = billSummary(g.all, today);
    const caption =
      filter === "paid"
        ? tn(g.entries.length, "{count} paid bill", "{count} paid bills")
        : totals.pending
          ? tn(totals.pending, "{count} pending bill", "{count} pending bills")
          : t("Up to date");
    const subtotal =
      filter === "paid"
        ? g.entries.length
          ? brl(totals.paid)
          : null
        : totals.pending
          ? billOpenLabel(totals)
          : null;
    return { ...g, totals, caption, subtotal };
  });
}
export function shortBillName(name: string, group: string): string {
  // Inside a group, drop a trailing "<group>" qualifier from the name, e.g.
  // "Water (Lake house)" under "Lake house" shows as "Water".
  const suffix = t(" ({group})", { group });
  return name
    .toLocaleLowerCase(locale())
    .endsWith(suffix.toLocaleLowerCase(locale()))
    ? name.slice(0, -suffix.length)
    : name;
}
