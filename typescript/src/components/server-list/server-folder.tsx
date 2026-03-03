"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { PillIndicator } from "./pill-indicator";
import { ServerIcon } from "./server-icon";
import { useGuildStore } from "@/stores/guild-store";
import type { Guild } from "@/types/server";

export interface ServerFolderData {
  id: string;
  name: string;
  color: string;
  servers: Guild[];
}

export function ServerFolder({
  folder,
  activeServerId,
}: {
  folder: ServerFolderData;
  activeServerId: string | null;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { collapsedFolders, toggleFolder } = useGuildStore();

  const isExpanded = !collapsedFolders.has(folder.id);
  const hasActiveServer = folder.servers.some((s) => s.id === activeServerId);

  // TODO: derive from actual unread/mention state
  const totalMentions = 0;
  const hasUnread = false;

  const pillState = hasActiveServer
    ? "selected"
    : isHovered
      ? "hover"
      : hasUnread
        ? "unread"
        : "none";

  // Show up to 4 mini server icons in collapsed grid
  const previewServers = folder.servers.slice(0, 4);

  if (isExpanded) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* Expanded folder wrapper with colored background */}
        <div
          className="flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2"
          style={{ backgroundColor: `${folder.color}33` }}
        >
          {/* Collapse button */}
          <button
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150",
              "bg-discord-bg-primary hover:rounded-[33%]"
            )}
            onClick={() => toggleFolder(folder.id)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-discord-interactive-normal"
            >
              <path
                d="M12 4C11.4477 4 11 4.44772 11 5V11H5C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13H11V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13V5C13 4.44772 12.5523 4 12 4Z"
                fill="currentColor"
                transform="rotate(45 12 12)"
              />
            </svg>
          </button>

          {/* Server icons inside folder */}
          {folder.servers.map((server) => (
            <ServerIcon
              key={server.id}
              server={server}
              isActive={activeServerId === server.id}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      <PillIndicator state={pillState} />
      <Tooltip content={folder.name} position="right">
        <button
          className={cn(
            "relative flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-150",
            isHovered ? "rounded-[33%]" : "rounded-full"
          )}
          style={{ backgroundColor: `${folder.color}66` }}
          onClick={() => toggleFolder(folder.id)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 2x2 grid of mini server icons */}
          <div className="grid grid-cols-2 gap-0.5">
            {previewServers.map((server) => (
              <div
                key={server.id}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-discord-bg-primary"
              >
                {server.icon ? (
                  <img
                    src={server.icon}
                    alt={server.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-[8px] font-medium text-discord-text-normal select-none">
                    {server.name.charAt(0)}
                  </span>
                )}
              </div>
            ))}
          </div>
          {totalMentions > 0 && (
            <Badge count={totalMentions} className="-bottom-1 -right-1 top-auto" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
