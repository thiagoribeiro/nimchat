import { NimletError, type NimletClient } from "./client";
import type { NimletEvent } from "./types";

export interface SyncEngineOptions {
  client: NimletClient;
  since?: string;
  timeoutMs?: number;
  onEvents: (events: NimletEvent[], nextBatch: string) => void;
  onError?: (err: unknown) => void;
}

// Mirrors the loop described in README.md's Sync model: re-open /sync immediately after
// each response (empty or not); PostgreSQL/Nimlet provide consistency, this loop is just
// the client-side half of long-polling. On error, back off instead of hot-looping.
export class SyncEngine {
  private readonly client: NimletClient;
  private since: string | undefined;
  private readonly timeoutMs: number;
  private readonly onEvents: SyncEngineOptions["onEvents"];
  private readonly onError?: SyncEngineOptions["onError"];
  private stopped = true;
  private running: Promise<void> | null = null;

  constructor(opts: SyncEngineOptions) {
    this.client = opts.client;
    this.since = opts.since;
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.onEvents = opts.onEvents;
    this.onError = opts.onError;
  }

  start(): void {
    this.stopped = false;
    if (this.running) return;
    this.running = this.loop();
  }

  stop(): void {
    this.stopped = true;
  }

  get cursor(): string | undefined {
    return this.since;
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      try {
        const res = await this.client.sync({ since: this.since, timeout: this.timeoutMs });
        if (res.events.length > 0) {
          this.onEvents(res.events, res.next_batch);
        }
        this.since = res.next_batch;
      } catch (err) {
        // The cursor is opaque and bound to the user; one the server rejects (e.g. from
        // another account) can only be dropped, which restarts from the beginning.
        if (this.since !== undefined && err instanceof NimletError && err.status === 400) {
          this.since = undefined;
          continue;
        }
        this.onError?.(err);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    this.running = null;
  }
}
