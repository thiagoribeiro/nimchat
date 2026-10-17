import { t } from "@nimchat/i18n";
import type { RoomListEntry, RoomState } from "@nimchat/sdk";

export interface RoomRefreshState {
  isRefreshingRooms: boolean;
  roomRefreshError: string | null;
}
interface RoomRefreshOptions {
  load: () => Promise<{ rooms: RoomListEntry[] }>;
  hydrate: (rooms: RoomListEntry[], complete?: boolean) => void;
  isCurrentSession: () => boolean;
  onState: (state: RoomRefreshState) => void;
}

// One controller per authenticated session, independent of how many lists are mounted.
export class RoomRefreshController {
  private disposed = false;
  private flight: Promise<void> | null = null;
  private interval: ReturnType<typeof setInterval> | undefined;
  private mutation = 0;
  private joined = new Map<
    string,
    { room: RoomListEntry; mutation: number }
  >();

  private readonly options: RoomRefreshOptions;
  constructor(options: RoomRefreshOptions) {
    this.options = options;
  }

  refresh(): Promise<void> {
    if (this.disposed || !this.options.isCurrentSession())
      return Promise.resolve();
    if (this.flight) return this.flight;
    const startedAt = this.mutation;
    this.options.onState({
      isRefreshingRooms: true,
      roomRefreshError: null
    });
    // Defer load so even synchronous failures follow the same lifecycle.
    const flight = Promise.resolve()
      .then(() => this.options.load())
      .then(
        (result) => {
          if (!this.disposed && this.options.isCurrentSession()) {
            const rooms = result.rooms.map((room) => {
              const confirmed = this.joined.get(room.room_id);
              return confirmed && confirmed.mutation > startedAt
                ? confirmed.room
                : room;
            });
            for (const [id, confirmed] of this.joined) {
              if (
                confirmed.mutation > startedAt &&
                !rooms.some((room) => room.room_id === id)
              )
                rooms.push(confirmed.room);
            }
            this.options.hydrate(rooms);
            for (const [id, confirmed] of this.joined) {
              if (confirmed.mutation <= startedAt) this.joined.delete(id);
            }
            this.options.onState({
              isRefreshingRooms: false,
              roomRefreshError: null
            });
          }
        },
        (error: unknown) => {
          if (!this.disposed && this.options.isCurrentSession()) {
            this.options.onState({
              isRefreshingRooms: false,
              roomRefreshError:
                t("Could not refresh the conversations. Try again.")
            });
          }
          throw error;
        }
      )
      .finally(() => {
        if (this.flight === flight) this.flight = null;
      });
    this.flight = flight;
    return flight;
  }

  setActive(active: boolean): void {
    clearInterval(this.interval);
    this.interval = undefined;
    if (!active || this.disposed) return;
    void this.refresh().catch(() => {});
    this.interval = setInterval(() => {
      void this.refresh().catch(() => {});
    }, 15000);
  }

  confirmJoined(room: RoomState): void {
    if (this.disposed || !this.options.isCurrentSession()) return;
    const confirmed: RoomListEntry = {
      room_id: room.room_id,
      name: room.name,
      join_rule: room.join_rule ?? "invite_only",
      role: room.role ?? "member",
      state: "join"
    };
    this.joined.set(room.room_id, {
      room: confirmed,
      mutation: ++this.mutation
    });
    this.options.hydrate([confirmed], false);
  }

  stop(): void {
    this.disposed = true;
    clearInterval(this.interval);
    this.interval = undefined;
  }
}

export async function acceptRoomInvitation(
  room: RoomState,
  options: {
    join: (roomId: string) => Promise<void>;
    isCurrentSession: () => boolean;
    confirmJoined: (room: RoomState) => void;
    open: (roomId: string) => void;
    refresh: () => Promise<void>;
  }
): Promise<void> {
  await options.join(room.room_id);
  if (!options.isCurrentSession()) return;
  options.confirmJoined(room);
  options.open(room.room_id);
  // Membership has been confirmed. A subsequent list failure must not undo acceptance.
  void options.refresh().catch(() => {});
}
