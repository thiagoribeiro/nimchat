import { t } from "@nimchat/i18n";
import { createStore } from "zustand/vanilla";
import { CommandQueue, commandKey } from "./command-queue.ts";
import type { QueueStorage, QueuedCommand } from "./command-queue.ts";

type Block = Record<string, any>;
type Trust = { publishers: ReadonlySet<string>; userId: string };
import type { CommandEvent as NimletEvent } from "./command-queue.ts";
export type PendingCommand = QueuedCommand;
export interface CommandResult {
  eventId: string;
  revision: number;
  txn?: string;
}
type Sender = (
  roomId: string,
  txn: string,
  content: Record<string, unknown>,
) => Promise<{ event_id: string }>;
interface CommandState {
  userId: string;
  ready: boolean;
  pending: Record<string, QueuedCommand>;
  commands: QueuedCommand[];
  results: Record<string, CommandResult>;
  initialize: (
    userId: string,
    storage: QueueStorage | null,
    trust: Trust,
    send: Sender,
    server?: string,
    namespace?: string,
    recover?: (room: string, eventId: string) => Promise<NimletEvent[]>,
  ) => void;
  stop: () => void;
  send: (
    roomId: string,
    block: Block,
    command: string,
    payload?: Record<string, unknown>,
    retry?: boolean,
  ) => Promise<string | undefined>;
  observe: (events: Record<string, NimletEvent[]>) => void;
  dismiss: (key: string) => void;
  setRooms: (rooms: ReadonlySet<string>) => void;
  retryPending: () => void;
}
export function createPluginCommandStore(
  uuid: () => string,
  now: () => number = Date.now,
  validView: (plugin: string, id: string, view: unknown) => boolean = (
    _p,
    _i,
    view,
  ) => !!view && typeof view === "object",
) {
  let queue: CommandQueue | undefined;
  return createStore<CommandState>((set, get) => {
    const update = () => {
      if (!queue) return;
      const pending: Record<string, QueuedCommand> = {};
      for (const c of queue.items) {
        const key = commandKey(c.roomId, c.plugin, c.instanceId);
        if (!pending[key]) pending[key] = c;
      }
      set({
        pending,
        commands: [...queue.items],
        results: { ...queue.results },
      });
    };
    return {
      userId: "",
      ready: false,
      pending: {},
      commands: [],
      results: {},
      initialize: (
        userId,
        storage,
        trust,
        send,
        server = "default",
        namespace = "default",
        recover,
      ) => {
        queue?.close();
        queue = new CommandQueue({
          scope: { server, namespace, user: userId },
          storage,
          uuid,
          now,
          publishers: trust.publishers,
          send,
          recover,
          validView: (plugin, instance_id, view) =>
            validView(plugin, instance_id, view),
        });
        queue.subscribe(update);
        set({ userId, ready: true });
        update();
      },
      stop: () => {
        queue?.close();
        queue = undefined;
        set({
          userId: "",
          ready: false,
          pending: {},
          commands: [],
          results: {},
        });
      },
      send: async (roomId, block, command, payload = {}, retry = false) => {
        if (!queue) throw new Error(t("Command queue unavailable."));
        const old =
          get().commands.find(
            (c) =>
              c.roomId === roomId &&
              c.plugin === block.plugin &&
              c.instanceId === block.instance_id &&
              c.status !== "rejected",
          ) ??
          get().pending[commandKey(roomId, block.plugin, block.instance_id)];
        if (retry) {
          if (old) await queue.retry(old.txn);
          return old?.txn;
        }
        const active = get().commands.find(
          (c) =>
            c.roomId === roomId &&
            c.plugin === block.plugin &&
            c.instanceId === block.instance_id &&
            c.status !== "rejected",
        );
        const serial = new Set([
          "preview_share",
          "share",
          "invite_participant",
          "remove_participant",
          "cancel_transfer",
        ]);
        if (active && (serial.has(command) || serial.has(active.command)))
          throw new Error(t("Wait for the previous command to be confirmed."));
        if (active && !["checklist", "monthly_bills"].includes(block.plugin))
          return;
        const txn = queue.enqueue(
          roomId,
          block.plugin,
          block.instance_id,
          block.view.revision,
          command,
          payload,
        );
        await queue.flush();
        return txn;
      },
      observe: (events) => queue?.observe(Object.values(events).flat()),
      dismiss: (key) => {
        const c = get().pending[key];
        if (c) queue?.dismiss(c.txn);
      },
      setRooms: (rooms) => queue?.setRooms(rooms),
      retryPending: () => {
        for (const c of queue?.items ?? [])
          if (c.status === "failed") void queue?.retry(c.txn);
      },
    };
  });
}
