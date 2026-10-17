"use client";

import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { useRoom } from "@/components/chat/room-provider";

export default function RoomPage() {
  const { roomId, name } = useRoom();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatMessages />
      <ChatInput roomId={roomId} name={name} />
    </div>
  );
}
