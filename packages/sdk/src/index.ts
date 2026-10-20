export { NimletClient, NimletError } from "./client";
export type { NimletClientOptions } from "./client";

export { InMemoryTokenStorage, LocalStorageTokenStorage } from "./storage";
export type { TokenStorage } from "./storage";

export { SyncEngine } from "./sync";
export type { SyncEngineOptions } from "./sync";

export {
  RETAIN_PER_ROOM,
  cachedRooms,
  createTimelinePersister,
  retainTimeline,
  validSnapshot,
} from "./timeline-cache";
export type {
  RetainOptions,
  TimelineCacheStorage,
  TimelinePersister,
  TimelineSnapshot,
} from "./timeline-cache";

export { useChatStore, groupReactions } from "./store";
export type { RoomState } from "./store";

export { rejectedSession, useAuthStore } from "./auth";
export type { CachedIdentity, IdentityStorage } from "./auth";

export * from "./types";

export { CommandQueue, commandKey, recoverCommandHistory } from "./command-queue";
export type { QueuedCommand, QueueStorage } from "./command-queue";
export { createPluginCommandStore } from "./plugin-command-store";

export { loadSharedSurfaceHistory } from "./shared-history";
