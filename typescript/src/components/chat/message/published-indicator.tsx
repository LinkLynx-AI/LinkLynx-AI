"use client";

import { Megaphone } from "lucide-react";

export function PublishedIndicator({ serverCount }: { serverCount: number }) {
  return (
    <div className="flex items-center gap-1 mt-1">
      <Megaphone className="h-3.5 w-3.5 text-discord-btn-success" />
      <span className="text-xs text-discord-btn-success">
        {serverCount}個のサーバーに公開済み
      </span>
    </div>
  );
}
