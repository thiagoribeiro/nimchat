import type { Page } from "@playwright/test";
import { supported } from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import type { NimletEvent, RoomListEntry } from "@nimchat/sdk";

export const block = (plugin: string, view: Block): Block => ({
  type: "plugin", plugin, instance_id: plugin, version: "1.0", schema_version: "1.0",
  fallback_markdown: plugin, view: { owner_id: "me", revision: 1, ...view },
});
export const form = block("form_stateful", { title: "Cadastro salvo", status: "draft",
  fields: [{ id: "name", label: "Nome", type: "text", required: true }, { id: "active", label: "Ativo", type: "boolean" },
    { id: "count", label: "Quantidade", type: "number" }, { id: "city", label: "Cidade", type: "text" }, { id: "optional", label: "Opcional", type: "text" }],
  values: { name: "Maria", active: true, count: 0, city: "Recife", optional: "" }, errors: {},
});
const date = new Date().toISOString();
export const agentView = { title: "Atividade QA", owner_id: "me", request_id: "qa", revision: 1, sequence: 1,
  status: "running", current_status: "Pensando QA", started_at: date, updated_at: date, heartbeat_at: date,
  finished_at: null, history_total: 1, active_activities: [],
  history: [{ id: "phase", label: "Primeira etapa QA", status: "completed", started_at: date, finished_at: date, duration_ms: 100 }],
};
export const blocks = [form,
  block("workflow", { title: "Execução real", status: "running", steps: [{ id: "step", title: "Validar documento", status: "running" }] }),
  block("approval", { title: "Aprovação pendente", status: "pending" }),
  block("poll", { question: "Quais opções escolher?", status: "open", allow_multiple: true,
    options: [{ id: "a", label: "Opção A", votes: 1 }, { id: "b", label: "Opção B", votes: 0 }], votes_by_user: { me: ["a"] } }),
  block("checklist", { title: "Documentos QA", status: "open", items: [{ id: "a", label: "Passaporte QA", checked: false }] }),
  block("agent_status", agentView),
];
export interface CapturedCommand { txn: string; eventId: string; content: Block; }
export async function mockBackend(page: Page) {
  for (const item of blocks) if (!supported(item)) throw new Error("Invalid fixture: " + item.plugin);
  const state = {
    rooms: [{ room_id: "room", name: "Sala teste", state: "join", role: "owner", join_rule: "invite_only" },
      { room_id: "invited", name: "Convite teste", state: "invite", role: "member", join_rule: "invite_only" }] as RoomListEntry[],
    events: blocks.map((item, i): NimletEvent => ({ event_id: "card-" + item.plugin, room_id: "room", room_seq: i + 1,
      type: "m.ui.message", sender_id: "review-agent", sender_display_name: "Agente QA", origin_server_ts: Date.now(),
      content: { schema: "brian.message", version: "1.0", body: [item] } })),
    queue: [] as NimletEvent[], commands: [] as CapturedCommand[], requests: 0,
    failRooms: false, loseCommandResponse: false, failText: false,
  };
  const transactions = new Map<string, string>();
  await page.context().route("https://nimlet.test/**", async (route) => {
    const request = route.request(), url = new URL(request.url());
    let data: unknown = {}; let status = 200;
    if (url.pathname === "/me") data = { user_id: "me", device_id: "device", username: "qa", display_name: "QA" };
    else if (url.pathname === "/rooms") { state.requests++; status = state.failRooms ? 503 : 200; data = { rooms: state.rooms }; }
    else if (url.pathname.endsWith("/messages")) {
      const roomId = url.pathname.split("/")[2];
      const events = state.events.filter((event) => event.room_id === roomId);
      data = { start: events.at(-1)?.room_seq ?? 0, end: events[0]?.room_seq ?? 0, chunk: events };
    } else if (url.pathname === "/sync") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      data = { next_batch: "opaque-qa-cursor", events: state.queue.splice(0) };
    } else if (url.pathname.endsWith("/join")) {
      const room = state.rooms.find((r) => r.room_id === url.pathname.split("/")[2]);
      if (room) room.state = "join";
      status = 204;
    } else if (url.pathname.includes("/send/m.plugin.command/")) {
      const txn = url.pathname.split("/").at(-1)!;
      const eventId = transactions.get(txn) ?? "command-" + (transactions.size + 1);
      transactions.set(txn, eventId);
      state.commands.push({ txn, eventId, content: request.postDataJSON() });
      if (state.loseCommandResponse) { state.loseCommandResponse = false; status = 503; }
      data = { event_id: eventId, room_seq: 100 + state.commands.length };
    } else if (url.pathname.includes("/send/m.room.message/")) { status = state.failText ? 503 : 200; data = { event_id: "text", room_seq: 100 }; }
    else if (url.pathname.includes("/send/m.ui.surface.preference.updated/")) {
      publish("m.ui.surface.preference.updated", request.postDataJSON(), "me");
      data = { event_id: "preference", room_seq: 200 };
    }
    await route.fulfill({ status, contentType: "application/json", body: status === 204 ? undefined : JSON.stringify(data) });
  });
  await page.context().addInitScript(() => localStorage.setItem("nimchat_access_token", "qa-only"));
  function publish(type: string, content: Block, sender = "review-publisher", roomId = "room") {
    const event: NimletEvent = { event_id: "update-" + state.events.length, room_id: roomId,
      room_seq: state.events.length + 10, type, content, sender_id: sender, sender_display_name: sender === "review-agent" ? "Agente QA" : "Publisher QA", origin_server_ts: Date.now() };
    state.events.push(event); state.queue.push(event); return event;
  }
  const update = (plugin: string, view: Block, command?: CapturedCommand, sender?: string) => publish("m.plugin.state.updated", {
    plugin, instance_id: plugin, view, ...(command ? { command_event_id: command.eventId } : {}),
  }, sender);
  return { state, update, publish };
}
