"use client";
import { t } from "@nimchat/i18n";
import { useSync } from "@/components/providers/sync-provider";
import { NimletError, useAuthStore } from "@nimchat/sdk";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { getNimletClient } from "@/lib/nimlet";
export function NewDMModal() {
  const { isOpen, type, onClose } = useModal();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const me = useAuthStore((s) => s.userId);
  const { confirmRoomJoined } = useSync();
  const router = useRouter();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = username.trim();
    if (!query || loading) return;
    setLoading(true);
    setError("");
    try {
      const client = getNimletClient();
      const user = await client.resolveUsername(query);
      if (user.user_id === me) {
        setError(t("Choose someone else."));
        return;
      }
      const room = await client.getOrCreateDM(user.user_id);
      confirmRoomJoined(room);
      onClose();
      setUsername("");
      router.push("/rooms/" + encodeURIComponent(room.room_id));
    } catch (err) {
      setError(
        err instanceof NimletError && err.status === 404
          ? t("User not found in this namespace.")
          : t("Could not start the conversation.")
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={isOpen && type === "newDM"} onOpenChange={onClose}>
      <DialogContent className="bg-[#0F172A] text-slate-100">
        <DialogHeader>
          <DialogTitle>{t("New direct message")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <p className="text-sm text-slate-400">
            {t("Enter the exact username. Nimlet does not offer partial search yet.")}
          </p>
          <input
            autoFocus
            autoComplete="off"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
            placeholder={t("Username")}
            aria-label={t("Username")}
            className="min-h-[44px] w-full rounded-lg bg-[#1A2338] p-3 outline-violet-500"
          />
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!username.trim() || loading}
            className="min-h-[44px] w-full rounded-lg bg-violet-600 text-white disabled:opacity-50"
          >
            {loading ? t("Opening…") : t("Start conversation")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
