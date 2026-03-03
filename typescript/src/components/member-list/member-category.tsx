"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function MemberCategory({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center px-2 pt-6 pb-1 text-xs font-semibold uppercase tracking-wide text-discord-channels-default hover:text-discord-interactive-hover"
      >
        <ChevronDown
          className={cn("mr-0.5 h-3 w-3 transition-transform", collapsed && "-rotate-90")}
        />
        <span className="truncate">{name}</span>
        <span className="ml-auto">{count}</span>
      </button>
      {!collapsed && children}
    </div>
  );
}
