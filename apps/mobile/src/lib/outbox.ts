import type { MessageContent } from "@nimchat/sdk";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";

import { getNimletClient } from "./nimlet";

// Local echo for outgoing text. It is not a second source of truth: an entry
// disappears as soon as the server event with its event_id is in the store.
// Retrying reuses the transaction id, and PUT /send/{type}/{txn} is idempotent.
export interface OutgoingMessage {
  txn: string;
  roomId: string;
  body: string;
  metadata?: MessageContent["metadata"];
  status: "sending" | "failed" | "sent";
  eventId?: string;
  createdAt: number;
}

interface OutboxState {
  items: Record<string, OutgoingMessage>;
  send: (
    roomId: string,
    body: string,
    metadata?: MessageContent["metadata"],
  ) => void;
  retry: (txn: string) => void;
  discard: (txn: string) => void;
}

export const useOutbox = create<OutboxState>((set, get) => {
  const deliver = async (txn: string) => {
    const item = get().items[txn];
    if (!item) return;
    set((s) => ({
      items: { ...s.items, [txn]: { ...item, status: "sending" } },
    }));
    try {
      const res = await getNimletClient().sendEvent<MessageContent>(
        item.roomId,
        "m.room.message",
        txn,
        { msgtype: "m.text", body: item.body, metadata: item.metadata },
      );
      set((s) =>
        s.items[txn]
          ? {
              items: {
                ...s.items,
                [txn]: {
                  ...s.items[txn],
                  status: "sent",
                  eventId: res.event_id,
                },
              },
            }
          : s,
      );
    } catch {
      set((s) =>
        s.items[txn]
          ? {
              items: {
                ...s.items,
                [txn]: { ...s.items[txn], status: "failed" },
              },
            }
          : s,
      );
    }
  };
  return {
    items: {},
    send: (roomId, body, metadata) => {
      const txn = uuidv4();
      set((s) => ({
        items: {
          ...s.items,
          [txn]: {
            txn,
            roomId,
            body,
            metadata,
            status: "sending",
            createdAt: Date.now(),
          },
        },
      }));
      void deliver(txn);
    },
    retry: (txn) => void deliver(txn),
    discard: (txn) =>
      set((s) => {
        const items = { ...s.items };
        delete items[txn];
        return { items };
      }),
  };
});
