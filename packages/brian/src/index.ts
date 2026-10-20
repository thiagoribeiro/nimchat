import { t, msg } from "@nimchat/i18n";
import { validMonthlyBills } from "./monthly-bills.ts";
import * as validators from "./validators.js";
import catalog from "./catalog.js";

// Schema validation precedes access to extensible renderer data.
export type Block = Record<string, any>;
export interface Event {
  event_id: string;
  room_id: string;
  sender_id: string;
  type: string;
  room_seq: number; // order within the room; not comparable across rooms
  origin_server_ts?: number;
  content: unknown;
}
export interface Trust {
  publishers: ReadonlySet<string>;
  agents: ReadonlySet<string>;
  userId: string;
}
export interface Surface {
  key: string;
  roomId: string;
  block: Block;
  sourceEventId: string;
  createdAt?: number;
  originKnown?: boolean;
  activity: number; // room_seq of the latest change; compare only within the surface's room
  activityAt: number; // origin_server_ts of that change; comparable across rooms
  userPin: boolean;
  dismissed: boolean;
  active: boolean;
  title: string;
  priority: number;
}
const known = new Set([
  "monthly_bills",
  "agent_status",
  "approval",
  "workflow",
  "form_stateful",
  "checklist",
  "poll",
]);
const v = validators as unknown as Record<string, (value: unknown) => boolean>;
const object = (x: unknown): x is Block =>
  !!x && typeof x === "object" && !Array.isArray(x);
export const instanceKey = (room: string, plugin: string, id: string) =>
  JSON.stringify([room, plugin, id]);
export function supported(block: Block): boolean {
  if (block.type !== "plugin") return !!v["core_" + block.type]?.(block);
  const view = block.view;
  if (
    !object(view) ||
    JSON.stringify(view).length >
      (block.plugin === "monthly_bills" ? 1048576 : 128000)
  )
    return false;
  if (
    (view.items?.length ?? 0) > 100 ||
    (view.options?.length ?? 0) > 20 ||
    (view.fields?.length ?? 0) > 50 ||
    (view.steps?.length ?? 0) > 200
  )
    return false;
  return (
    known.has(block.plugin) &&
    block.version === "1.0" &&
    block.schema_version === "1.0" &&
    v.plugins_plugin_block(block) &&
    (block.plugin === "monthly_bills"
      ? validMonthlyBills(block.view)
      : v["plugins_" + block.plugin + "_block"]?.(block.view)) === true &&
    Number.isSafeInteger(block.view?.revision) &&
    block.view.revision > 0
  );
}
export function decode(content: unknown): Block[] {
  if (
    !object(content) ||
    content.schema !== "brian.message" ||
    !Array.isArray(content.body) ||
    content.body.length > 100
  )
    return [{ type: "markdown", text: t("BRIAN content unavailable.") }];
  if (content.version !== "1.0")
    return [
      {
        type: "markdown",
        text: content.body
          .map((b: unknown) => (object(b) ? fallback(b) : ""))
          .join("\n"),
      },
    ];
  return content.body.map((b: unknown) => {
    if (object(b) && supported(b)) return b;
    return {
      type: "markdown",
      text: object(b) ? fallback(b) : t("Block unavailable."),
    };
  });
}
export function fallback(block: Block): string {
  return String(
    block.fallback_markdown ||
      block.text ||
      block.title ||
      block.description ||
      t("Unsupported content."),
  ).slice(0, 20000);
}
export function textContent(content: unknown): string {
  return decode(content)
    .map((b) =>
      b.type === "key_value"
        ? b.items
            .map((x: Block) => `${x.key}: ${String(x.value ?? "—")}`)
            .join("\n")
        : fallback(b),
    )
    .join("\n");
}
function policy(block: Block): { active: boolean; priority: number } {
  const entry =
    block.plugin === "monthly_bills"
      ? { surfaces: { auto_pin_when: ["open"], auto_unpin_when: ["archived"] } }
      : catalog.plugins.find((p) => p.name === block.plugin);
  const status = block.view?.status;
  const rules = entry?.surfaces as
    { auto_pin_when?: string[]; auto_unpin_when?: string[] } | undefined;
  const active =
    !!rules?.auto_pin_when?.includes(status) ||
    (!rules?.auto_unpin_when?.includes(status) && !!block.surface?.auto_pin);
  return {
    active: block.view?.transfer?.phase === "moved" ? false : active,
    priority:
      ({ low: 0, normal: 1, high: 2, urgent: 3 } as Record<string, number>)[
        block.surface?.priority
      ] ?? 1,
  };
}
export function project(
  events: readonly Event[],
  trust: Trust,
): Map<string, Surface> {
  const surfaces = new Map<string, Surface>();
  const states = new Map<string, { block: Block; event: Event }>();
  const preferences = new Map<
    string,
    { userPin: boolean; dismissed: boolean }
  >();
  // Surfaces are keyed per room, so only the order within each room matters.
  for (const e of [...events].sort((a, b) => a.room_seq - b.room_seq)) {
    const c = e.content;
    if (!object(c)) continue;
    if (
      e.type === "m.ui.message" &&
      (trust.agents.has(e.sender_id) || trust.publishers.has(e.sender_id))
    ) {
      for (const block of decode(c)) {
        if (block.type !== "plugin" || !supported(block)) continue;
        const key = instanceKey(e.room_id, block.plugin, block.instance_id);
        const previous = surfaces.get(key);
        // Keep the first card as the audit anchor, and never regress its view.
        if (previous && previous.block.view.revision >= block.view.revision)
          continue;
        surfaces.set(key, {
          key,
          roomId: e.room_id,
          block,
          sourceEventId: previous?.originKnown
            ? previous.sourceEventId
            : e.event_id,
          originKnown: true,
          createdAt:
            block.view?.shared && typeof block.view?.created_at === "string"
              ? Date.parse(block.view.created_at)
              : (previous?.createdAt ?? e.origin_server_ts),
          activity: e.room_seq,
          activityAt: e.origin_server_ts ?? 0,
          title: block.view.title || block.plugin,
          userPin: false,
          dismissed: false,
          ...policy(block),
        });
      }
    } else if (
      (e.type === "m.plugin.state.updated" ||
        e.type === "m.plugin.instance.created") &&
      trust.publishers.has(e.sender_id)
    ) {
      if (
        typeof c.plugin !== "string" ||
        typeof c.instance_id !== "string" ||
        !object(c.view)
      )
        continue;
      const candidate = {
        type: "plugin",
        plugin: c.plugin,
        version: "1.0",
        schema_version: "1.0",
        instance_id: c.instance_id,
        view: c.view,
        fallback_markdown: `${c.view.title || c.plugin} — ${c.view.status}`,
      };
      if (!supported(candidate)) continue;
      const key = instanceKey(e.room_id, c.plugin, c.instance_id);
      const old = states.get(key);
      if (!old || c.view.revision > old.block.view.revision)
        states.set(key, { block: candidate, event: e });
    } else if (
      e.type === "m.ui.surface.dismissed" &&
      e.sender_id === trust.userId &&
      v.events_surface_dismissed(c) &&
      typeof c.plugin === "string" &&
      typeof c.instance_id === "string"
    ) {
      const key = instanceKey(e.room_id, c.plugin, c.instance_id);
      preferences.set(key, {
        userPin: preferences.get(key)?.userPin ?? false,
        dismissed: true,
      });
    } else if (
      e.type === "m.ui.surface.preference.updated" &&
      e.sender_id === trust.userId &&
      v.events_surface_preference_updated(c)
    ) {
      preferences.set(instanceKey(e.room_id, c.plugin, c.instance_id), {
        userPin: c.user_pin,
        dismissed: c.dismissed,
      });
    }
  }
  // A bounded history page may contain a current state but not the original
  // card. A validated publisher snapshot is sufficient to recover the surface.
  // When the card is available it remains the audit anchor.
  for (const [key, { block, event }] of states) {
    if (surfaces.has(key)) continue;
    surfaces.set(key, {
      key,
      roomId: event.room_id,
      block,
      sourceEventId: event.event_id,
      originKnown: false,
      createdAt:
        block.view?.shared && typeof block.view?.created_at === "string"
          ? Date.parse(block.view.created_at)
          : undefined,
      activity: event.room_seq,
      activityAt: event.origin_server_ts ?? 0,
      title: block.view.title || block.plugin,
      userPin: false,
      dismissed: false,
      ...policy(block),
    });
  }
  for (const [key, s] of surfaces) {
    const state = states.get(key);
    if (state && state.block.view.revision >= s.block.view.revision) {
      s.block = { ...s.block, view: state.block.view };
      if (state.event.room_seq > s.activity) {
        s.activity = state.event.room_seq;
        s.activityAt = state.event.origin_server_ts ?? s.activityAt;
      }
      s.title = state.block.view.title || s.title;
      Object.assign(s, policy(s.block));
    }
    Object.assign(s, preferences.get(key));
  }
  return surfaces;
}
// Keys under which a bounded timeline cache keeps an event older than its window, so
// project() over the retained slice still recovers every surface: the publisher's state
// snapshots and the user's surface preferences. Cards (m.ui.message) are not pinned: they
// render as timeline rows, and an old one kept alone would sit above a gap in the history.
// A snapshot without its card is enough (originKnown: false), as with a bounded page.
export function surfacePins(trust: Trust): (e: Event) => string[] {
  return (e) => {
    const c = e.content;
    if (
      !object(c) ||
      typeof c.plugin !== "string" ||
      typeof c.instance_id !== "string"
    )
      return [];
    const key = instanceKey(e.room_id, c.plugin, c.instance_id);
    if (
      (e.type === "m.plugin.state.updated" ||
        e.type === "m.plugin.instance.created") &&
      trust.publishers.has(e.sender_id)
    )
      return ["state:" + key];
    if (
      (e.type === "m.ui.surface.dismissed" ||
        e.type === "m.ui.surface.preference.updated") &&
      e.sender_id === trust.userId
    )
      return [e.type + ":" + key];
    return [];
  };
}
export function activeSurfaces(surfaces: Map<string, Surface>): Surface[] {
  return [...surfaces.values()]
    .filter((s) => !s.dismissed && (s.userPin || s.active))
    .sort(
      (a, b) =>
        Number(b.userPin) - Number(a.userPin) ||
        b.priority - a.priority ||
        b.activityAt - a.activityAt,
    );
}
export function authoritativeRejection(
  events: readonly Event[],
  txnEventId: string,
  trust: Trust,
): string | undefined {
  for (const e of events) {
    if (
      e.type === "m.plugin.command.rejected" &&
      trust.publishers.has(e.sender_id) &&
      object(e.content) &&
      e.content.command_event_id === txnEventId
    )
      return String(e.content.reason);
  }
}

export function statusStale(view: Block, now = Date.now()): boolean {
  return (
    view.status === "running" && now - Date.parse(view.heartbeat_at) > 60000
  );
}
export function statusDuration(
  start: string,
  end?: string | null,
  now = Date.now(),
): string {
  const seconds = Math.max(
    0,
    Math.floor(((end ? Date.parse(end) : now) - Date.parse(start)) / 1000),
  );
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}min ${seconds % 60}s`
    : `${seconds}s`;
}

// Presentation helpers shared by every surface view (reference, list, focus).
// They read projected data only; they never decide plugin state.
// Labels are English message keys, translated when read.
const pluginLabels: Record<string, string> = {
  monthly_bills: msg("Monthly bills"),
  approval: msg("Approval"),
  workflow: msg("Workflow"),
  checklist: msg("Checklist"),
  poll: msg("Poll"),
  form_stateful: msg("Form"),
  agent_status: msg("Agent activity"),
};
export function pluginLabel(plugin: string): string {
  const label = pluginLabels[plugin];
  return label ? t(label) : plugin.replace(/_/g, " ");
}
export function surfaceTitle(
  surface: Pick<Surface, "title" | "block">,
): string {
  const title = surface.title?.trim();
  return title && title !== surface.block.plugin
    ? title
    : pluginLabel(surface.block.plugin);
}
export type StatusTone = "active" | "waiting" | "done" | "failed" | "neutral";
const statusLabels: Record<string, [string, StatusTone]> = {
  pending: [msg("Pending"), "waiting"],
  waiting: [msg("Waiting"), "waiting"],
  waiting_user: [msg("Waiting for you"), "waiting"],
  created: [msg("Created"), "active"],
  running: [msg("In progress"), "active"],
  open: [msg("status::Open"), "active"],
  draft: [msg("Draft"), "active"],
  invalid: [msg("With errors"), "failed"],
  approved: [msg("Approved"), "done"],
  completed: [msg("Done"), "done"],
  submitted: [msg("Sent"), "done"],
  closed: [msg("Closed"), "done"],
  archived: [msg("Archived"), "neutral"],
  rejected: [msg("Rejected"), "failed"],
  failed: [msg("Failed"), "failed"],
  interrupted: [msg("Interrupted"), "failed"],
  cancelled: [msg("Cancelled"), "neutral"],
  expired: [msg("Expired"), "neutral"],
};
export function statusInfo(
  view: Block | undefined,
  now = Date.now(),
): { label: string; tone: StatusTone } {
  if (view?.transfer?.phase === "moved")
    return { label: t("Moved"), tone: "neutral" };
  const raw = String(view?.status ?? "");
  const status =
    raw === "pending" && view?.expires_at && Date.parse(view.expires_at) <= now
      ? "expired"
      : raw;
  const known = statusLabels[status];
  return known
    ? { label: t(known[0]), tone: known[1] }
    : { label: status || "—", tone: "neutral" };
}
// Terminal = the catalog policy would auto-unpin this status.
export function terminal(block: Block): boolean {
  if (block.view?.transfer?.phase === "moved") return true;
  const entry =
    block.plugin === "monthly_bills"
      ? { surfaces: { auto_pin_when: ["open"], auto_unpin_when: ["archived"] } }
      : catalog.plugins.find((p) => p.name === block.plugin);
  const rules = entry?.surfaces as { auto_unpin_when?: string[] } | undefined;
  return !!rules?.auto_unpin_when?.includes(block.view?.status);
}
export interface SurfaceSections {
  pinned: Surface[];
  active: Surface[];
  recent: Surface[];
  archived: Surface[];
}
// Order from UX Spec v2 §3.2: user pins, then active by priority/activity,
// then recent; finished or hidden surfaces stay reachable as archived.
// Always scoped to one room: equal instance ids in other rooms never mix.
export function surfaceSections(
  surfaces: Map<string, Surface>,
  roomId: string,
): SurfaceSections {
  const sections: SurfaceSections = {
    pinned: [],
    active: [],
    recent: [],
    archived: [],
  };
  for (const s of surfaces.values()) {
    if (s.roomId !== roomId) continue;
    if (s.dismissed) sections.archived.push(s);
    else if (s.userPin) sections.pinned.push(s);
    else if (s.active) sections.active.push(s);
    else if (terminal(s.block)) sections.archived.push(s);
    else sections.recent.push(s);
  }
  const byActivity = (a: Surface, b: Surface) => b.activity - a.activity;
  sections.pinned.sort(byActivity);
  sections.active.sort((a, b) => b.priority - a.priority || byActivity(a, b));
  sections.recent.sort(byActivity);
  sections.archived.sort(byActivity);
  return sections;
}
export function hasNews(
  surface: Surface,
  seen: Record<string, number>,
): boolean {
  return surface.activity > (seen[surface.key] ?? 0);
}

export {
  overlayView,
  isSharedRoom,
  surfaceReference,
  referenceTarget,
  localReference,
  canEdit,
  creationLabel,
} from "./interaction.ts";

export { brl, parseBRL, billTotals, billAmountInput, reconcileBillAmountInput } from "./monthly-bills.ts";

export { formValues, reconcileDraft, formInputValue, formQuestion } from "./form-fields.ts";
export type { FormDraft } from "./form-fields.ts";
export { otherBillGroup, billGroup, billToday, shiftBillMonth, billMonthLabel, billMonthName, billDateLabel, validBillDate, billSummary, billOpenLabel, groupBills, shortBillName } from "./monthly-bills.ts";
export type { BillFilter } from "./monthly-bills.ts";
export { useMonthlyBills } from "./use-monthly-bills.ts";
export type { BillsProps } from "./use-monthly-bills.ts";
