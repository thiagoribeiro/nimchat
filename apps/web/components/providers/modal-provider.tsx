"use client";

import React, { useEffect, useState } from "react";

import { InviteModal } from "@/components/modals/invite-modal";
import { CreateRoomModal } from "@/components/modals/create-room-modal";
import { NewConversationModal } from "@/components/modals/new-conversation-modal";
import { NewDMModal } from "@/components/modals/new-dm-modal";

export function ModalProvider() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <>
      <InviteModal />
      <CreateRoomModal />
      <NewConversationModal />
      <NewDMModal />
    </>
  );
}
