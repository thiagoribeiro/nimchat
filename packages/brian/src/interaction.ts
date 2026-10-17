import { t, locale, timeZone } from "@nimchat/i18n";
import { supported, instanceKey } from "./index.ts";
import type { Block, Surface } from "./index.ts";

export function overlayView(
  base: Block,
  commands: readonly {
    command: string;
    payload: Record<string, unknown>;
    status: string;
  }[],
): Block {
  const view = JSON.parse(JSON.stringify(base));
  for (const c of commands) {
    if (c.status === "rejected") continue;
    if (["check_item", "uncheck_item"].includes(c.command)) {
      for (const item of view.items ?? [])
        if (item.id === c.payload.item_id)
          item.checked = c.command === "check_item";
      if (view.items?.length)
        view.status = view.items.every((i: Block) => i.checked)
          ? "completed"
          : "open";
    } else if (c.command === "rename") view.title = c.payload.title;
    else if (c.command === "save" && c.payload.values)
      view.values = { ...view.values, ...(c.payload.values as object) };
  }
  return view;
}
export const SHARED_ROOM =
  /^#shared-surface:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}#$/i;
export const isSharedRoom = (name: string) => SHARED_ROOM.test(name);
export function surfaceReference(s: Surface): Block {
  return {
    type: "reference",
    title: s.title,
    kind: "surface",
    room_id: s.roomId,
    event_id: s.sourceEventId,
    metadata: { plugin: s.block.plugin, instance_id: s.block.instance_id },
  };
}
export function referenceTarget(
  ref: Block,
): { roomId: string; plugin: string; instanceId: string } | undefined {
  if (
    !supported(ref) ||
    ref.type !== "reference" ||
    ref.kind !== "surface" ||
    typeof ref.room_id !== "string" ||
    typeof ref.metadata?.plugin !== "string" ||
    typeof ref.metadata?.instance_id !== "string"
  )
    return;
  return {
    roomId: ref.room_id,
    plugin: ref.metadata.plugin,
    instanceId: ref.metadata.instance_id,
  };
}
export function localReference(
  ref: Block,
  room: string,
  surfaces: Map<string, Surface>,
): Surface | undefined {
  const target = referenceTarget(ref);
  if (!target || target.roomId !== room) return;
  return surfaces.get(instanceKey(target.roomId, target.plugin, target.instanceId));
}
export const canEdit = (view: Block, user: string) =>
  view.owner_id === user || view.acl?.[user] === "editor";
export function creationLabel(createdAt?: number, tag: string = locale()) {
  if (!createdAt) return t("Creation date unavailable");
  return (
    t("Created {date}", {
      date: new Intl.DateTimeFormat(tag, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(createdAt),
    }) +
    " · " +
    timeZone()
  );
}
