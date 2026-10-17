export interface InviteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const invitationStorageKey = (user: string) => "nimchat:invite-dismissals:v1:" + encodeURIComponent(user);

// Local preference only. This never changes server membership or sends events.
export class InviteDismissals {
  private dismissed = new Set<string>();
  readonly user: string;
  private storage: InviteStorage;
  private onChange: (ids: ReadonlySet<string>) => void;
  constructor(user: string, storage: InviteStorage, onChange: (ids: ReadonlySet<string>) => void) {
    this.user = user; this.storage = storage; this.onChange = onChange;
    try {
      const value: unknown = JSON.parse(storage.getItem(invitationStorageKey(user)) ?? "[]");
      if (Array.isArray(value) && value.every((id) => typeof id === "string")) this.dismissed = new Set(value);
    } catch {}
    onChange(new Set(this.dismissed));
  }
  dismiss(roomId: string) { this.update(roomId, true); }
  restore(roomId: string) { this.update(roomId, false); }
  private update(roomId: string, dismiss: boolean) {
    const next = new Set(this.dismissed);
    if (dismiss) next.add(roomId); else next.delete(roomId);
    // Failed persistence must not falsely report a durable dismissal.
    this.storage.setItem(invitationStorageKey(this.user), JSON.stringify([...next]));
    this.dismissed = next;
    this.onChange(new Set(next));
  }
}
