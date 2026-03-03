"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { PillIndicator } from "./pill-indicator";
import { useUIStore } from "@/stores/ui-store";
import type { Guild } from "@/types/server";

export function ServerIcon({
  server,
  isActive,
  hasUnread = false,
  mentionCount = 0,
  isMuted = false,
}: {
  server: Guild;
  isActive: boolean;
  hasUnread?: boolean;
  mentionCount?: number;
  isMuted?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      showContextMenu("server", { x: e.clientX, y: e.clientY }, { server });
    },
    [server, showContextMenu],
  );

  const pillState = isActive
    ? "selected"
    : isHovered
      ? "hover"
      : hasUnread && !isMuted
        ? "unread"
        : "none";

  const initials = server.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="relative flex items-center justify-center">
      <PillIndicator state={pillState} />
      <Tooltip content={server.name} position="right">
        <Link
          href={`/channels/${server.id}`}
          onContextMenu={handleContextMenu}
          className={cn(
            "relative flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-150",
            isActive || isHovered ? "rounded-[33%]" : "rounded-full",
            isMuted && "opacity-60",
            server.icon
              ? ""
              : isActive || isHovered
                ? "bg-discord-brand-blurple text-white"
                : "bg-discord-bg-primary text-discord-text-normal",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {server.icon ? (
            <img src={server.icon} alt={server.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-medium select-none">{initials}</span>
          )}
          {mentionCount > 0 && (
            <Badge count={mentionCount} className="-bottom-1 -right-1 top-auto" />
          )}
        </Link>
      </Tooltip>
    </div>
  );
}
