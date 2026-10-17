import { t } from "@nimchat/i18n";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RoomSidebar } from "@/components/rooms/room-sidebar";

export function MobileToggle() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("Open conversations")}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0" onEscapeKeyDown={(event) => {
        // A nested menu owns Escape, even before Radix's layer effects settle.
        if (event.target instanceof Element && event.target.closest('[role="menu"]')) event.preventDefault();
      }} onCloseAutoFocus={(event) => {
        if (document.querySelector('[role="dialog"][data-state="open"]')) event.preventDefault();
      }}>
        <SheetTitle className="sr-only">{t("Conversations")}</SheetTitle>
        <RoomSidebar onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
