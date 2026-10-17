"use client";
import { t } from "@nimchat/i18n";
import { isSharedRoom } from "@nimchat/brian";
import { SharedSurfaces } from "@/components/brian/shared-surfaces";

import { useAuthStore, useChatStore } from "@nimchat/sdk";
import type { RoomState } from "@nimchat/sdk";
import {
  MessageCircle,
  Plus,
  UserPlus,
  LogOut,
  RefreshCw,
  MoreVertical
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useModal } from "@/hooks/use-modal-store";
import type { ModalType } from "@/hooks/use-modal-store";
import { getNimletClient } from "@/lib/nimlet";
import { acceptRoomInvitation } from "@/lib/room-refresh";
import { useSync } from "@/components/providers/sync-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

const roomTitle = (room: RoomState) =>
  isSharedRoom(room.name) ? t("Shared surface") : room.name;

export function RoomSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const rooms = useChatStore((s) => s.rooms);
  const user = useAuthStore((s) => s.displayName ?? s.username ?? "");
  const logout = useAuthStore((s) => s.logout);
  const path = usePathname();
  const router = useRouter();
  const onOpen = useModal((s) => s.onOpen);
  const {
    refreshRooms,
    confirmRoomJoined,
    isRefreshingRooms,
    roomRefreshError,
    dismissedInvites,
    dismissInvite,
    restoreInvite
  } = useSync();
  const [showDismissed, setShowDismissed] = useState(false);
  const [inviteMenu, setInviteMenu] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("rooms");
  useEffect(() => {
    if (
      path.startsWith("/shared/") ||
      searchParams.get("tab") === "shared"
    )
      setTab("shared");
  }, [path, searchParams]);
  const [search, setSearch] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [error, setError] = useState("");
  const list = useMemo(
    () =>
      Object.values(rooms)
        .filter(
          (r) =>
            r.state === "join" &&
            !isSharedRoom(r.name) &&
            r.name.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rooms, search]
  );
  const invites = Object.values(rooms).filter(
    (r) =>
      r.state === "invite" &&
      (tab === "shared" ? isSharedRoom(r.name) : !isSharedRoom(r.name))
  );
  const hidden = invites.filter((room) =>
    dismissedInvites.has(room.room_id)
  );
  const visibleInvites = invites.filter(
    (room) => showDismissed || !dismissedInvites.has(room.room_id)
  );
  const dismiss = (room: RoomState) => {
    setError("");
    try {
      if (dismissedInvites.has(room.room_id)) restoreInvite(room.room_id);
      else dismissInvite(room.room_id);
    } catch {
      setError(
        t("Could not save the preference on this device. Try again.")
      );
    }
  };
  const launch = (type: ModalType, data = {}) => {
    onNavigate?.();
    onOpen(type, data);
  };
  const accept = async (room: RoomState) => {
    if (busy.current) return;
    busy.current = true;
    const userId = useAuthStore.getState().userId;
    setJoining(room.room_id);
    setError("");
    try {
      await acceptRoomInvitation(room, {
        join: (id) => getNimletClient().joinRoom(id),
        isCurrentSession: () =>
          mounted.current &&
          useAuthStore.getState().isAuthenticated &&
          useAuthStore.getState().userId === userId,
        confirmJoined: confirmRoomJoined,
        open: (id) => {
          onNavigate?.();
          router.push(
            (isSharedRoom(room.name) ? "/shared/" : "/rooms/") +
              encodeURIComponent(id)
          );
        },
        refresh: refreshRooms
      });
    } catch {
      setError(t("Could not accept the invitation. Try again."));
    } finally {
      busy.current = false;
      setJoining(null);
    }
  };
  const signOut = async () => {
    try {
      await logout(getNimletClient());
      onNavigate?.();
      router.replace("/login");
    } catch {
      setError(t("Could not log out. Try again."));
    }
  };
  return (
    <aside className="flex h-full w-full flex-col border-r border-[#26324A] bg-[#0F172A] text-slate-200">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-[#26324A] px-4">
        <div className="min-w-0">
          <span className="text-lg font-bold text-violet-300">
            NimChat
          </span>
          <p className="truncate text-xs text-slate-400">{user}</p>
        </div>
        <button
          type="button"
          onClick={() => launch("newConversation")}
          aria-label={t("New conversation")}
          title={t("New conversation")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-500"
        >
          <Plus size={21} />
        </button>
      </div>
      <div role="tablist" className="flex gap-3 px-3">
        <button
          role="tab"
          aria-selected={tab === "rooms"}
          className="min-h-[44px] text-sm"
          onClick={() => setTab("rooms")}
        >
          {t("Conversations")}
        </button>
        <button
          role="tab"
          aria-selected={tab === "shared"}
          className="min-h-[44px] text-sm"
          onClick={() => setTab("shared")}
        >
          {t("Surfaces")}
        </button>
      </div>
      <div className="flex items-center gap-1 p-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("Search conversations")}
          placeholder={t("Search conversations")}
          className="min-w-0 flex-1 rounded-lg border border-[#26324A] bg-[#0B1222] px-3 py-2 text-sm outline-violet-500"
        />
        <button
          type="button"
          aria-label={t("Refresh conversations")}
          disabled={isRefreshingRooms}
          onClick={() => void refreshRooms().catch(() => {})}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[#1A2338] disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={isRefreshingRooms ? "animate-spin" : ""}
          />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {invites.length > 0 && (
          <section className="mb-4 space-y-2 rounded-xl border border-violet-500/30 p-2">
            <h2 className="px-1 text-xs font-semibold uppercase text-slate-400">
              {t("Invitations ({count})", { count: invites.length - hidden.length })}
            </h2>
            {hidden.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDismissed(!showDismissed)}
                className="min-h-[44px] px-1 text-left text-xs text-violet-300"
              >
                {showDismissed
                  ? t("Hide dismissed")
                  : t("Show invitations dismissed on this device ({count})", { count: hidden.length })}
              </button>
            )}
            {visibleInvites.map((room) => (
              <div
                key={room.room_id}
                className="flex items-center gap-2 rounded-lg bg-[#1A2338] p-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {roomTitle(room)}
                  </span>
                  {dismissedInvites.has(room.room_id) && (
                    <p className="text-xs text-slate-400">
                      {t("Dismissed on this device · invitation still active on the server")}
                    </p>
                  )}
                </div>
                <DropdownMenu
                  open={inviteMenu === room.room_id}
                  onOpenChange={(open) =>
                    setInviteMenu(open ? room.room_id : null)
                  }
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={
                        t("Invitation options for {name}", { name: roomTitle(room) })
                      }
                      disabled={!!joining}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-violet-200 disabled:opacity-50"
                    >
                      {joining === room.room_id ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <MoreVertical size={20} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onEscapeKeyDown={(event) => {
                      event.preventDefault();
                      setInviteMenu(null);
                    }}
                    className="w-64 border-[#26324A] bg-[#0F172A] text-slate-200"
                  >
                    <DropdownMenuLabel>
                      {roomTitle(room)}
                    </DropdownMenuLabel>
                    <p className="px-2 py-1 text-xs text-slate-400">
                      {t("Dismissing only hides it on this device. The invitation stays on the server and on your other devices.")}
                    </p>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={!!joining}
                      onSelect={() => void accept(room)}
                      className="min-h-[44px] focus:bg-[#1A2338]"
                      aria-label={
                        t("Accept invitation to {name}", { name: roomTitle(room) })
                      }
                    >
                      {t("Accept invitation")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!!joining}
                      onSelect={() => dismiss(room)}
                      className="min-h-[44px] focus:bg-[#1A2338]"
                    >
                      {dismissedInvites.has(room.room_id)
                        ? t("Restore invitation")
                        : t("Dismiss on this device")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </section>
        )}
        {tab === "shared" ? (
          <SharedSurfaces />
        ) : (
          <>
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t("Conversations")}
            </p>
            {list.map((room) => (
              <div
                key={room.room_id}
                className={
                  "group mb-1 flex items-center rounded-xl " +
                  (path.startsWith(
                    "/rooms/" + encodeURIComponent(room.room_id)
                  )
                    ? "bg-violet-500/15"
                    : "hover:bg-[#1A2338]")
                }
              >
                <Link
                  onClick={onNavigate}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-sm"
                  href={"/rooms/" + encodeURIComponent(room.room_id)}
                >
                  <MessageCircle
                    className="shrink-0 text-violet-300"
                    size={18}
                  />
                  <span className="truncate">
                    {room.name === "direct"
                      ? t("Direct message")
                      : room.name}
                  </span>
                </Link>
                {room.name !== "direct" && (
                  <button
                    type="button"
                    aria-label={t("Invite to {name}", { name: roomTitle(room) })}
                    title={t("Invite")}
                    onClick={() =>
                      launch("invite", {
                        roomId: room.room_id,
                        roomName: room.name
                      })
                    }
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-slate-400 hover:text-violet-200 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <UserPlus size={18} />
                  </button>
                )}
              </div>
            ))}
            {!list.length && (
              <p className="px-3 text-sm text-slate-400">
                {t("No conversations found.")}
              </p>
            )}
          </>
        )}
        {(error || roomRefreshError) && (
          <p role="alert" className="p-3 text-xs text-red-300">
            {error || roomRefreshError}
          </p>
        )}
      </div>
      <div className="border-t border-[#26324A] p-3">
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm text-slate-400 hover:bg-[#1A2338]"
        >
          <LogOut size={17} /> {t("Log out")}
        </button>
      </div>
    </aside>
  );
}
