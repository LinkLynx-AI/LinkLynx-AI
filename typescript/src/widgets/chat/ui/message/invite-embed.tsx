"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { CheckCircle, Users } from "lucide-react";

export function InviteEmbed({
  serverName,
  serverIcon,
  memberCount,
  onlineCount,
  inviteCode,
  onJoin,
  joined: initialJoined = false,
}: {
  serverName: string;
  serverIcon?: string;
  memberCount: number;
  onlineCount: number;
  inviteCode: string;
  onJoin?: () => void;
  joined?: boolean;
}) {
  const [joined, setJoined] = useState(initialJoined);

  const handleJoin = () => {
    setJoined(true);
    onJoin?.();
  };

  return (
    <div className="mt-1 max-w-[432px] rounded-lg bg-discord-bg-secondary p-4">
      <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
        サーバーに招待されました
      </p>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-discord-bg-tertiary text-lg font-bold text-discord-text-normal">
          {serverIcon ? (
            <img src={serverIcon} alt={serverName} className="h-12 w-12 rounded-2xl object-cover" />
          ) : (
            serverName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-base font-bold text-discord-text-normal">{serverName}</p>
            <CheckCircle className="h-4 w-4 shrink-0 text-discord-brand-blurple" />
          </div>
          <div className="flex items-center gap-3 text-xs text-discord-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-discord-brand-green" />
              {onlineCount.toLocaleString()} オンライン
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {memberCount.toLocaleString()} メンバー
            </span>
          </div>
        </div>
        <Button
          variant={joined ? "secondary" : "success"}
          size="sm"
          onClick={handleJoin}
          disabled={joined}
          className={cn(joined && "opacity-100 cursor-default")}
        >
          {joined ? "参加済み" : "参加"}
        </Button>
      </div>
    </div>
  );
}
