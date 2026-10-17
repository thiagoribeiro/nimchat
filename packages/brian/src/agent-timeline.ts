import { t } from "@nimchat/i18n";
import { decode, instanceKey, supported } from "./index.ts";
import type { Surface, Trust } from "./index.ts";
import type { NimletEvent } from "@nimchat/sdk";

const SOCIAL = new Set(["m.room.message", "m.room.attachment", "m.ui.message"]);
export interface TimelineRow {
  key: string;
  room_seq: number;
  readSeq: number;
  eventIds: string[];
  events: NimletEvent[];
  activities: Surface[];
  speaker?: { id: string; name: string };
}

function requestId(event: NimletEvent): string | undefined {
  const content = event.content as { metadata?: { request_event_id?: unknown } } | null;
  const id = content?.metadata?.request_event_id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

// Publisher identity remains on the original events for validation. It never
// becomes the speaker of an agent turn. Reply correlation is persisted by the
// connector before sending, so HTTP retries cannot change the command payload.
export function agentTimeline(events: readonly NimletEvent[], surfaces: ReadonlyMap<string, Surface>, trust: Trust): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const turns = new Map<string, TimelineRow>();
  const statuses = [...surfaces.values()].filter(s => s.block.plugin === "agent_status" &&
    events.some(e => e.room_id === s.roomId && e.event_id === s.sourceEventId));
  const getTurn = (room: string, request: string, agent: string): TimelineRow => {
    const key = `turn:${JSON.stringify([room, request, agent])}`;
    let row = turns.get(key);
    if (!row) {
      const origin = events.find(e => e.room_id === room && e.event_id === request);
      const identity = [...events].sort((a, b) => b.room_seq - a.room_seq)
        .find(e => e.room_id === room && e.sender_id === agent);
      row = { key, room_seq: origin ? origin.room_seq + 0.5 : Infinity, readSeq: 0,
        eventIds: [], events: [], activities: [], speaker: { id: agent, name: identity?.sender_display_name ?? t("Agent") } };
      turns.set(key, row); rows.push(row);
    }
    return row;
  };
  const agentFor = (surface: Surface) => {
    const replies = new Set(events.filter(e => e.room_id === surface.roomId && trust.agents.has(e.sender_id) &&
      requestId(e) === surface.block.view.request_id).map(e => e.sender_id));
    if (replies.size === 1) return [...replies][0];
    if (!replies.size && trust.agents.size === 1) return [...trust.agents][0];
    return undefined;
  };
  for (const surface of statuses) {
    const agent = agentFor(surface);
    const row = getTurn(surface.roomId, surface.block.view.request_id, agent ?? "");
    row.activities.push(surface);
    row.readSeq = Math.max(row.readSeq, surface.activity);
    if (!Number.isFinite(row.room_seq)) row.room_seq = surface.activity;
    row.eventIds.push(surface.sourceEventId);
  }
  // Conservative compatibility for old replies without metadata: require the
  // real request and a single non-overlapping execution interval. Never guess
  // across concurrent requests or across a partial history page.
  const legacyRequest = (event: NimletEvent): string | undefined => {
    const candidates = statuses.filter(s => {
      const request = events.find(e => e.room_id === s.roomId && e.event_id === s.block.view.request_id);
      const finished = Date.parse(s.block.view.finished_at ?? "");
      if (!request || request.sender_id !== s.block.view.owner_id || s.roomId !== event.room_id ||
        agentFor(s) !== event.sender_id || request.room_seq >= event.room_seq ||
        !Number.isFinite(finished) || event.origin_server_ts < Date.parse(s.block.view.started_at) ||
        event.origin_server_ts > finished + 5000) return false;
      if (events.some(e => e.room_id === event.room_id && e.type === "m.room.message" &&
        !trust.agents.has(e.sender_id) && !trust.publishers.has(e.sender_id) &&
        e.room_seq > request.room_seq && e.room_seq < event.room_seq)) return false;
      return !statuses.some(other => other !== s && other.roomId === s.roomId &&
        other.block.view.request_id !== s.block.view.request_id &&
        Date.parse(other.block.view.started_at) <= event.origin_server_ts &&
        (!other.block.view.finished_at || Date.parse(other.block.view.finished_at) >= request.origin_server_ts));
    });
    return candidates.length === 1 ? candidates[0].block.view.request_id : undefined;
  };
  for (const original of events) {
    if (!SOCIAL.has(original.type)) continue;
    let event = original;
    if (event.type === "m.ui.message" && (trust.agents.has(event.sender_id) || trust.publishers.has(event.sender_id))) {
      const content = event.content as { body?: unknown[] };
      const decoded = decode(content);
      const consumed = decoded.filter(b => b.type === "plugin" && b.plugin === "agent_status" && supported(b) &&
        surfaces.has(instanceKey(event.room_id, b.plugin, b.instance_id)));
      for (const block of consumed) {
        const surface = surfaces.get(instanceKey(event.room_id, block.plugin, block.instance_id))!;
        const row = getTurn(event.room_id, surface.block.view.request_id, agentFor(surface) ?? "");
        row.eventIds.push(event.event_id);
        row.readSeq = Math.max(row.readSeq, event.room_seq);
        row.room_seq = Math.min(row.room_seq, event.room_seq);
      }
      if (consumed.length) {
        const remaining = content.body?.filter(b => !consumed.includes(b as typeof consumed[number])) ?? [];
        if (!remaining.length) continue;
        event = { ...event, content: { ...content, body: remaining } };
      }
    }
    const correlated = trust.agents.has(event.sender_id) ? requestId(event) ?? legacyRequest(event) : undefined;
    if (correlated) {
      const row = getTurn(event.room_id, correlated, event.sender_id);
      row.events.push(event); row.eventIds.push(event.event_id);
      row.readSeq = Math.max(row.readSeq, event.room_seq);
      row.room_seq = Math.min(row.room_seq, event.room_seq);
      row.speaker = { id: event.sender_id, name: event.sender_display_name };
    } else rows.push({ key: event.event_id, room_seq: event.room_seq, readSeq: event.room_seq,
      eventIds: [event.event_id], events: [event], activities: [] });
  }
  for (const row of rows) {
    row.eventIds = [...new Set(row.eventIds)];
    row.events.sort((a, b) => a.room_seq - b.room_seq);
  }
  return rows;
}
