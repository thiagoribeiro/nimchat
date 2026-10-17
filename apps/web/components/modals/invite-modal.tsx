"use client";

import { t } from "@nimchat/i18n";
import React, { useState } from "react";
import { UserPlus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useModal } from "@/hooks/use-modal-store";
import { getNimletClient } from "@/lib/nimlet";
import { NimletError } from "@nimchat/sdk";

export function InviteModal() {
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "invite";
  const { roomId, roomName } = data;

  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onInvite = async () => {
    if (!roomId || !username) return;
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const client = getNimletClient();
      const user = await client.resolveUsername(username);
      await client.inviteUser(roomId, user.user_id);
      setSuccess(true);
      setUsername("");
    } catch (err) {
      if (err instanceof NimletError && err.status === 404) {
        setError(t('User "{name}" not found.', { name: username }));
      } else {
        setError(err instanceof Error ? err.message : t("Failed to invite"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-black p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t("Invite to {name}", { name: roomName === "direct" ? t("conversation") : roomName ?? "" })}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-3">
          <Label className="uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70">
            {t("Username")}
          </Label>
          <div className="flex items-center gap-x-2">
            <Input
              aria-label={t("Username to invite")}
              disabled={isLoading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alice"
              className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
            />
            <Button aria-label={t("Send invitation")} disabled={isLoading || !username} onClick={onInvite} size="icon">
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          {success && <p className="text-sm text-emerald-500">{t("Invitation sent!")}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
