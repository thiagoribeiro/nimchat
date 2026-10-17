import type { NimletEvent, MessagesResponse } from "./types.ts";

// A room may already contain messages while its surface publication is still
// outside the loaded history. Fetch until the caller validates that binding.
export async function loadSharedSurfaceHistory(options: {
  roomId: string;
  load: (room: string, opts: { dir: "b"; limit: number; from?: number }) => Promise<MessagesResponse>;
  ready: () => boolean;
  canRead: () => boolean;
  apply: (events: NimletEvent[]) => void;
}): Promise<"ready" | "missing" | "revoked"> {
  let from: number | undefined;
  for (;;) {
    if (!options.canRead()) return "revoked";
    if (options.ready()) return "ready";
    const result = await options.load(options.roomId, {
      dir: "b", limit: 100, ...(from === undefined ? {} : { from }),
    });
    if (!options.canRead()) return "revoked";
    options.apply(result.chunk);
    if (options.ready()) return "ready";
    if (!result.chunk.length || !Number.isSafeInteger(result.end) || result.end <= 0 || (from !== undefined && result.end >= from)) return "missing";
    from = result.end;
  }
}
