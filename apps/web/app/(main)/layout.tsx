"use client";

import React from "react";

import { AuthGate } from "@/components/auth-gate";
import { RoomSidebar } from "@/components/rooms/room-sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="h-full">
        <div className="hidden md:flex h-full w-60 z-30 flex-col fixed inset-y-0">
          <RoomSidebar />
        </div>
        <main className="md:pl-60 h-full">{children}</main>
      </div>
    </AuthGate>
  );
}
