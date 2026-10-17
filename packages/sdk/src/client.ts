import type { TokenStorage } from "./storage";
import type {
  CreateRoomRequest,
  ListRoomsResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  MessagesResponse,
  NimletEvent,
  RegisterRequest,
  RegisterResponse,
  ResolveUsernameResponse,
  RoomSummary,
  SendEventResponse,
  SyncResponse,
  UploadMediaResponse,
} from "./types";

export class NimletError extends Error {
  readonly status: number;
  readonly body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "NimletError";
    this.status = status;
    this.body = body;
  }
}

export interface NimletClientOptions {
  baseUrl: string;
  storage: TokenStorage;
}

// Thin typed wrapper over the HTTP contract in internal/transport/http/server.go. No React,
// no DOM assumptions beyond `fetch`/`FormData`/`Blob` (all available in RN + browsers).
export class NimletClient {
  private readonly baseUrl: string;
  private readonly storage: TokenStorage;

  constructor(opts: NimletClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.storage = opts.storage;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    auth = true,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (
      init.body &&
      typeof init.body === "string" &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    if (auth) {
      const token = await this.storage.getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        // no JSON body on this error response
      }
      throw new NimletError(
        `${init.method ?? "GET"} ${path} -> ${res.status}`,
        res.status,
        body,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async register(req: RegisterRequest): Promise<RegisterResponse> {
    const res = await this.request<RegisterResponse>(
      "/register",
      { method: "POST", body: JSON.stringify(req) },
      false,
    );
    await this.storage.setToken(res.access_token);
    return res;
  }

  async login(req: LoginRequest): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>(
      "/login",
      { method: "POST", body: JSON.stringify(req) },
      false,
    );
    await this.storage.setToken(res.access_token);
    return res;
  }

  async logout(): Promise<void> {
    await this.request<void>("/logout", { method: "DELETE" });
    await this.storage.setToken(null);
  }

  createRoom(req: CreateRoomRequest): Promise<RoomSummary> {
    return this.request<RoomSummary>("/rooms", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async listRooms(): Promise<ListRoomsResponse> {
    const rooms: ListRoomsResponse["rooms"] = [];
    const seen = new Set<string>();
    let after = "";
    do {
      const page = await this.request<ListRoomsResponse>(
        "/rooms?limit=100" +
          (after ? "&after=" + encodeURIComponent(after) : ""),
      );
      rooms.push(...page.rooms);
      after = page.next ?? "";
      if (after && seen.has(after))
        throw new Error("Room pagination did not advance");
      if (after) seen.add(after);
    } while (after);
    return { rooms };
  }

  me(): Promise<MeResponse> {
    return this.request<MeResponse>("/me");
  }

  // Registers this device's raw FCM token for push delivery — deviceId is derived
  // server-side from the session, never sent by the client (see PUT /me/push-token).
  setPushToken(pushToken: string): Promise<void> {
    return this.request<void>("/me/push-token", {
      method: "PUT",
      body: JSON.stringify({ push_token: pushToken }),
    });
  }

  resolveUsername(username: string): Promise<ResolveUsernameResponse> {
    return this.request<ResolveUsernameResponse>(
      `/users/by-username/${encodeURIComponent(username)}`,
    );
  }

  inviteUser(roomId: string, userId: string): Promise<void> {
    return this.request<void>(`/rooms/${roomId}/invite`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  }

  joinRoom(roomId: string): Promise<void> {
    return this.request<void>(`/rooms/${roomId}/join`, { method: "POST" });
  }

  getOrCreateDM(userId: string): Promise<RoomSummary> {
    return this.request<RoomSummary>(`/dm/${userId}`, { method: "POST" });
  }

  sendEvent<TContent>(
    roomId: string,
    eventType: string,
    txnId: string,
    content: TContent,
  ): Promise<SendEventResponse> {
    return this.request<SendEventResponse>(
      `/rooms/${roomId}/send/${eventType}/${txnId}`,
      { method: "PUT", body: JSON.stringify(content) },
    );
  }

  // `from` is a room_seq (exclusive). Omit it with dir "b" to start at the newest event.
  getMessages(
    roomId: string,
    opts: { from?: number; dir?: "b" | "f"; limit?: number } = {},
  ): Promise<MessagesResponse> {
    const params = new URLSearchParams();
    if (opts.from !== undefined) params.set("from", String(opts.from));
    if (opts.dir) params.set("dir", opts.dir);
    if (opts.limit) params.set("limit", String(opts.limit));
    return this.request<MessagesResponse>(
      `/rooms/${roomId}/messages?${params.toString()}`,
    );
  }

  // Long-poll: resolves either as soon as new events exist, or after `timeout` ms with an
  // empty batch. Callers loop on this (see sync.ts) — do not call once and stop. `since` is
  // the previous response's opaque next_batch; omit it on the first sync.
  sync(opts: { since?: string; timeout?: number } = {}): Promise<SyncResponse> {
    const params = new URLSearchParams();
    if (opts.since) params.set("since", opts.since);
    params.set("timeout", String(opts.timeout ?? 30000));
    return this.request<SyncResponse>(`/sync?${params.toString()}`);
  }

  async uploadMedia(
    file: Blob,
    filename?: string,
  ): Promise<UploadMediaResponse> {
    const form = new FormData();
    form.append("file", file, filename);
    const token = await this.storage.getToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${this.baseUrl}/media/upload`, {
      method: "POST",
      body: form,
      headers,
    });
    if (!res.ok) {
      throw new NimletError(
        `POST /media/upload -> ${res.status}`,
        res.status,
      );
    }
    return (await res.json()) as UploadMediaResponse;
  }

  // GET /media/{id} requires a Bearer token, so a plain <img src> can't hit it directly
  // (browsers/RN don't attach custom headers to markup-driven requests). Fetch as a blob and
  // hand back an object URL the UI can use as a normal image source instead.
  async fetchMediaObjectUrl(contentUri: string): Promise<string> {
    const mediaId = this.mediaIdFromUri(contentUri);
    const token = await this.storage.getToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${this.baseUrl}/media/${mediaId}`, { headers });
    if (!res.ok) {
      throw new NimletError(
        `GET /media/${mediaId} -> ${res.status}`,
        res.status,
      );
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  // Pure URL construction, no fetch and no platform APIs — unlike fetchMediaObjectUrl above,
  // this works anywhere (e.g. React Native's <Image source={{uri, headers}}>, which can
  // attach the Authorization header itself and doesn't need a Blob/object URL).
  getMediaUrl(contentUri: string): string {
    return `${this.baseUrl}/media/${this.mediaIdFromUri(contentUri)}`;
  }

  private mediaIdFromUri(contentUri: string): string {
    // "mxc://<server>/<mediaId>" -> "<mediaId>"
    return contentUri.replace(/^mxc:\/\/[^/]+\//, "");
  }
}

export type { NimletEvent };
