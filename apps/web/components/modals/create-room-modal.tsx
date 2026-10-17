"use client";
import { t } from "@nimchat/i18n";
import { useSync } from "@/components/providers/sync-provider";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useModal } from "@/hooks/use-modal-store";
import { getNimletClient } from "@/lib/nimlet";

export function CreateRoomModal() {
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "createRoom";
  const { confirmRoomJoined } = useSync();
  const router = useRouter();

  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsLoading(true);
    setError(null);
    try {
      const room = await getNimletClient().createRoom({ name });
      confirmRoomJoined(room);
      setName("");
      onClose();
      router.push(`/rooms/${room.room_id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Failed to create room")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white text-black p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            {t("New room")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="p-6 space-y-3">
          <Label className="uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70">
            {t("Room name")}
          </Label>
          <Input
            disabled={isLoading}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="general"
            className="bg-zinc-300/50 border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <Button
            disabled={isLoading || !name}
            type="submit"
            className="w-full"
          >
            {t("Create room")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
