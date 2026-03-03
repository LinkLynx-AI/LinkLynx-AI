"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function ServerHeader({ serverName }: { serverName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "flex h-12 w-full shrink-0 items-center justify-between px-4",
        "shadow-[0_1px_0_0_rgba(0,0,0,0.2)] transition-colors",
        "hover:bg-discord-bg-mod-hover",
      )}
    >
      <span className="truncate font-semibold text-discord-header-primary">{serverName}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-discord-channels-default transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );
}
