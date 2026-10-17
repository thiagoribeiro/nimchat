"use client";

import { t } from "@nimchat/i18n";
import { Badge } from "@/components/ui/badge";
import { useSync } from "@/components/providers/sync-provider";

// Replaces the donor's socket-indicatior — "live" here means the SyncEngine long-poll loop
// is running, not that a persistent connection is open (there isn't one with long-polling).
export function SyncIndicator() {
  const { isConnected } = useSync();

  if (!isConnected) {
    return (
      <Badge variant="outline" className="bg-yellow-600 text-white border-none">
        {t("Reconnecting...")}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-emerald-600 text-white border-none">
      {t("Live")}
    </Badge>
  );
}
