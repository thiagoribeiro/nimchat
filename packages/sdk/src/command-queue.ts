import { t } from "@nimchat/i18n";
type QueueOptions = {
  scope: { server: string; namespace: string; user: string };
  storage: QueueStorage | null;
  uuid: () => string;
  now?: () => number;
  publishers: ReadonlySet<string>;
  validView: (plugin: string, instance: string, view: unknown) => boolean;
  send: (
    room: string,
    txn: string,
    content: Record<string, unknown>,
  ) => Promise<{ event_id: string }>;
  timeoutMs?: number;
  recover?: (room: string, eventId: string) => Promise<CommandEvent[]>;
};
// Transport-independent durable command queue. Business transitions belong to plugins.
export interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface QueuedCommand {
  roomId: string;
  plugin: string;
  instanceId: string;
  txn: string;
  revision: number;
  command: string;
  payload: Record<string, unknown>;
  startedAt: number;
  eventId?: string;
  status: "queued" | "sending" | "waiting" | "failed" | "rejected";
  error?: string;
}
export interface CommandEvent {
  event_id: string;
  room_id: string;
  sender_id: string;
  type: string;
  room_seq: number;
  content: unknown;
}
export const commandKey = (room: string, plugin: string, id: string) =>
  JSON.stringify([room, plugin, id]);
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export class CommandQueue {
  items: QueuedCommand[] = [];
  results: Record<string, { eventId: string; revision: number; txn?: string }> =
    {};
  private listeners = new Set<() => void>();
  private events: CommandEvent[] = [];
  private live = true;
  private running = new Set<string>();
  private acknowledgements = new Map<string, ReturnType<typeof setTimeout>>();
  private rooms: ReadonlySet<string> | undefined;
  private recovering = new Set<string>();
  private options: QueueOptions;
  constructor(options: QueueOptions) {
    this.options = options;
    try {
      let raw = options.storage?.getItem(this.storageKey);
      if (
        !raw &&
        options.scope.namespace === "default" &&
        options.scope.server === "default"
      ) {
        const legacy = JSON.parse(
          options.storage?.getItem(
            "nimchat:pending:v1:" + encodeURIComponent(options.scope.user),
          ) ?? "{}",
        );
        if (object(legacy))
          raw = JSON.stringify(
            Object.values(legacy).map((v: any) => ({
              ...v,
              startedAt: v.startedAt ?? Date.now(),
              status:
                v.status ??
                (v.rejected ? "rejected" : v.eventId ? "waiting" : "failed"),
            })),
          );
      }
      const saved: unknown = JSON.parse(raw ?? "[]");
      if (Array.isArray(saved))
        this.items = saved
          .filter(
            (v): v is QueuedCommand =>
              object(v) &&
              ["roomId", "plugin", "instanceId", "txn", "command"].every(
                (k) => typeof v[k] === "string" && v[k].length > 0,
              ) &&
              object(v.payload) &&
              Number.isSafeInteger(v.revision) &&
              typeof v.startedAt === "number" &&
              ["queued", "sending", "waiting", "failed", "rejected"].includes(
                v.status,
              ) &&
              (v.eventId === undefined || typeof v.eventId === "string"),
          )
          .map((v) =>
            v.status === "sending" || v.status === "waiting"
              ? { ...v, status: "failed", error: t("Delivery not confirmed.") }
              : v,
          );
    } catch {
      /* An invalid local cache cannot authorize a command. */
    }
  }
  get storageKey() {
    return "nimchat:commands:v3:" + JSON.stringify(this.options.scope);
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private save(next: QueuedCommand[]) {
    // Persist before making an intent eligible for delivery. A full disk must not send it.
    if (!this.options.storage && next.length)
      throw new Error(t("Local storage unavailable"));
    this.options.storage?.setItem(this.storageKey, JSON.stringify(next));
    this.items = next;
    for (const [txn, timer] of this.acknowledgements) {
      if (!next.some((c) => c.txn === txn && c.status === "waiting")) {
        clearTimeout(timer);
        this.acknowledgements.delete(txn);
      }
    }
    for (const item of next) {
      if (item.status !== "waiting" || this.acknowledgements.has(item.txn))
        continue;
      this.acknowledgements.set(
        item.txn,
        setTimeout(() => {
          this.acknowledgements.delete(item.txn);
          if (!this.live) return;
          this.save(
            this.items.map((c) =>
              c.txn === item.txn && c.status === "waiting"
                ? {
                    ...c,
                    status: "failed",
                    error:
                      t("Result not confirmed. The intent was kept."),
                  }
                : c,
            ),
          );
        }, this.options.timeoutMs ?? 30000),
      );
    }
    for (const fn of this.listeners) fn();
  }
  close() {
    this.live = false;
    for (const timer of this.acknowledgements.values()) clearTimeout(timer);
    this.acknowledgements.clear();
    this.listeners.clear();
  }
  enqueue(
    roomId: string,
    plugin: string,
    instanceId: string,
    revision: number,
    command: string,
    payload = {},
  ) {
    if (!this.live || (this.rooms && !this.rooms.has(roomId)))
      throw new Error(t("No access to the surface."));
    const item: QueuedCommand = {
      roomId,
      plugin,
      instanceId,
      revision,
      command,
      payload: JSON.parse(JSON.stringify(payload)),
      txn: this.options.uuid(),
      startedAt: (this.options.now ?? Date.now)(),
      status: "queued",
    };
    this.save([...this.items, item]);
    return item.txn;
  }
  // Called only with a complete membership refresh, never a partial /rooms page.
  setRooms(joined: ReadonlySet<string>) {
    this.rooms = joined;
    this.save(this.items.filter((c) => joined.has(c.roomId)));
    void this.flush();
  }
  dismiss(txn: string) {
    this.save(
      this.items.filter((c) => c.txn !== txn || c.status !== "rejected"),
    );
  }
  async retry(txn: string) {
    const item = this.items.find((c) => c.txn === txn);
    if (!item || item.status === "rejected" || item.status === "sending")
      return;
    if (this.recovering.has(txn)) return;
    this.recovering.add(txn);
    const recover = async () => {
      const current = this.items.find((c) => c.txn === txn);
      if (
        !this.live ||
        !current?.eventId ||
        !this.options.recover ||
        (this.rooms && !this.rooms.has(current.roomId))
      )
        return;
      try {
        const events = await this.options.recover(
          current.roomId,
          current.eventId,
        );
        if (this.live) this.observe([...this.events, ...events]);
      } catch {
        /* An unavailable history cannot confirm or reject an intent. */
      }
    };
    try {
      await recover();
      if (
        !this.live ||
        !this.items.some((c) => c.txn === txn && c.status !== "rejected")
      )
        return;
      this.save(
        this.items.map((c) =>
          c.txn === txn ? { ...c, status: "queued", error: undefined } : c,
        ),
      );
      await this.flush();
      await recover();
    } finally {
      this.recovering.delete(txn);
    }
  }
  observe(events: CommandEvent[]) {
    this.events = events;
    const before = JSON.stringify(this.items);
    const results = { ...this.results };
    const next = this.items.filter((item) => {
      if (!item.eventId || item.status === "rejected") return true;
      for (const e of events
        .filter((e) => e.room_id === item.roomId)
        .sort((a, b) => a.room_seq - b.room_seq)) {
        const c = e.content;
        if (
          !this.options.publishers.has(e.sender_id) ||
          !object(c) ||
          c.plugin !== item.plugin ||
          c.instance_id !== item.instanceId ||
          c.command_event_id !== item.eventId
        )
          continue;
        if (
          e.type === "m.plugin.command.rejected" &&
          typeof c.reason === "string"
        ) {
          item.status = "rejected";
          item.error = c.reason;
          return true;
        }
        if (
          e.type === "m.plugin.state.updated" &&
          this.options.validView(item.plugin, item.instanceId, c.view) &&
          Number.isSafeInteger(c.view.revision) &&
          (c.view.revision > item.revision ||
            (item.command === "refresh" && c.view.revision === item.revision))
        ) {
          results[commandKey(item.roomId, item.plugin, item.instanceId)] = {
            eventId: item.eventId,
            txn: item.txn,
            revision: c.view.revision,
          };
          return false;
        }
      }
      return true;
    });
    this.results = results;
    if (JSON.stringify(next) !== before || next.length !== this.items.length)
      this.save(next);
    void this.flush();
  }
  async flush() {
    if (!this.live) return;
    const heads = new Map<string, QueuedCommand>();
    for (const c of this.items) {
      if (c.status === "rejected") continue;
      const k = commandKey(c.roomId, c.plugin, c.instanceId);
      if (!heads.has(k)) heads.set(k, c);
    }
    await Promise.all(
      [...heads].map(async ([key, item]) => {
        if (
          item.status !== "queued" ||
          this.running.has(key) ||
          (this.rooms && !this.rooms.has(item.roomId))
        )
          return;
        this.running.add(key);
        this.save(
          this.items.map((c) =>
            c.txn === item.txn ? { ...c, status: "sending" } : c,
          ),
        );
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            this.options.send(item.roomId, item.txn, {
              plugin: item.plugin,
              instance_id: item.instanceId,
              command: item.command,
              payload: item.payload,
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("timeout")),
                this.options.timeoutMs ?? 30000,
              );
            }),
          ]);
          if (!this.live) return;
          this.save(
            this.items.map((c) =>
              c.txn === item.txn
                ? {
                    ...c,
                    eventId: result.event_id,
                    status: "waiting",
                    error: undefined,
                  }
                : c,
            ),
          );
          this.observe(this.events);
        } catch (error) {
          const code =
            typeof error === "object" && error !== null
              ? Number((error as any).status)
              : 0;
          const definitive = [400, 403, 404, 409, 413].includes(code);
          if (this.live)
            this.save(
              this.items.map((c) =>
                c.txn === item.txn
                  ? {
                      ...c,
                      status: definitive ? "rejected" : "failed",
                      error: definitive
                        ? t("The server refused the command. Check your access and the data.")
                        : t("Delivery not confirmed. The intent was kept."),
                    }
                  : c,
              ),
            );
        } finally {
          clearTimeout(timer);
          this.running.delete(key);
          if (this.live && !this.items.some((c) => c.txn === item.txn))
            void this.flush();
        }
      }),
    );
  }
}

// Recovery uses room-local pagination. Neither a newer revision nor an HTTP
// acknowledgement substitutes for the command's own trusted plugin result.
export async function recoverCommandHistory(
  client: {
    getMessages: (
      room: string,
      opts: { dir: "b"; limit: number; from?: number },
    ) => Promise<{ chunk: CommandEvent[]; end: number }>;
  },
  room: string,
  eventId: string,
  apply: (room: string, events: CommandEvent[]) => void,
): Promise<CommandEvent[]> {
  const events: CommandEvent[] = [];
  let from: number | undefined;
  for (let page = 0; page < 20; page++) {
    const result = await client.getMessages(room, {
      dir: "b",
      limit: 100,
      ...(from === undefined ? {} : { from }),
    });
    events.push(...result.chunk);
    apply(room, result.chunk);
    if (
      !result.chunk.length ||
      result.chunk.some((e) => e.event_id === eventId) ||
      result.end <= 0 ||
      result.end === from
    )
      break;
    from = result.end;
  }
  return events;
}
