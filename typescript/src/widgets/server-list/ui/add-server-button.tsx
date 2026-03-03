"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Tooltip } from "@/shared/ui/tooltip-simple";
import { useUIStore } from "@/shared/model/stores/ui-store";

export function AddServerButton() {
  const [isHovered, setIsHovered] = useState(false);
  const openModal = useUIStore((s) => s.openModal);

  return (
    <Tooltip content="サーバーを追加" position="right">
      <button
        className={cn(
          "flex h-12 w-12 items-center justify-center transition-all duration-150",
          isHovered
            ? "rounded-[33%] bg-discord-brand-green text-white"
            : "rounded-full bg-discord-bg-primary text-discord-brand-green",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => openModal("create-server")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C12.5523 2 13 2.44772 13 3V11H21C21.5523 11 22 11.4477 22 12C22 12.5523 21.5523 13 21 13H13V21C13 21.5523 12.5523 22 12 22C11.4477 22 11 21.5523 11 21V13H3C2.44772 13 2 12.5523 2 12C2 11.4477 2.44772 11 3 11H11V3C11 2.44772 11.4477 2 12 2Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </Tooltip>
  );
}
