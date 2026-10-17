// Shapes mirror the real Go DTOs in nimlet's internal/transport/http and internal/wire (not
// just the README) — see handler_auth.go, handler_room.go, handler_event.go, handler_sync.go.

export type UserType = "human" | "agent" | "bot" | "system" | "service";

export interface RegisterRequest {
  username: string;
  password: string;
  display_name: string;
  device_name: string;
}

export interface RegisterResponse {
  user_id: string;
  device_id: string;
  access_token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  device_name: string;
  device_id?: string; // reuse the device from a previous login instead of creating one
}

export interface LoginResponse {
  session_id: string;
  user_id: string;
  device_id: string;
  access_token: string;
}

export interface MeResponse {
  user_id: string;
  device_id: string;
  username: string;
  display_name: string;
}

export interface ResolveUsernameResponse {
  user_id: string;
  username: string;
  display_name: string;
}

export interface RoomListEntry {
  room_id: string;
  name: string;
  join_rule: string;
  state: "invite" | "join" | "leave" | "ban";
  role: string;
}

export interface ListRoomsResponse {
  next?: string;
  rooms: RoomListEntry[];
}

export interface CreateRoomRequest {
  name: string;
  visibility?: "public" | "private";
}

export interface RoomSummary {
  room_id: string;
  name: string;
  creator_id?: string;
  join_rule?: string;
}

export interface SendEventResponse {
  event_id: string;
  room_seq: number;
}

export interface NimletEvent<TContent = unknown> {
  event_id: string;
  // Position within its room (1, 2, 3 …, may have gaps), in /sync delivery order. Only
  // comparable between events of the same room; use origin_server_ts across rooms.
  room_seq: number;
  room_id: string;
  sender_id: string;
  sender_display_name: string;
  type: string;
  content: TContent;
  origin_server_ts: number; // milliseconds
}

export interface SyncResponse {
  next_batch: string; // opaque: pass back unchanged as `since`
  events: NimletEvent[];
}

export interface MessagesResponse {
  start: number; // room_seq
  end: number; // room_seq of the last event: pass as `from` for the next page
  chunk: NimletEvent[];
}

export interface UploadMediaResponse {
  media_id: string;
  content_uri: string; // "mxc://<server>/<mediaId>"
}

// Client-defined event content shapes. Nimlet itself imposes no schema on `content` or
// allowlist on `type` (internal/domain/event.go — EventType is a free string), so these are
// conventions this client introduces, not something the server validates.
export interface MessageContent {
  metadata?: {
    surface_references?: Record<string, unknown>[];
    continuation_of?: string;
  };
  msgtype: "m.text";
  body: string;
}

export interface ReactionContent {
  relates_to: string; // target event_id
  emoji: string;
}

export interface AttachmentContent {
  content_uri: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  caption?: string;
  width?: number;
  height?: number;
}
