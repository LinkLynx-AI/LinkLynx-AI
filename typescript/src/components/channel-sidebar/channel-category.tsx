"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function ChannelCategory({
  name,
  collapsed,
  onToggle,
  children,
}: {
  name: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        className={cn(
          "group flex w-full items-center gap-0.5 px-0.5 pb-1",
          "text-category text-discord-channels-default",
          "hover:text-discord-interactive-hover"
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{name}</span>
      </button>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}
