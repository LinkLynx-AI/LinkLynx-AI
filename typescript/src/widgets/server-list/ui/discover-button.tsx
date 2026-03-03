"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Tooltip } from "@/shared/ui/legacy/tooltip";

export function DiscoverButton() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip content="公開サーバーを探す" position="right">
      <button
        className={cn(
          "flex h-12 w-12 items-center justify-center transition-all duration-150",
          isHovered
            ? "rounded-[33%] bg-discord-brand-green text-white"
            : "rounded-full bg-discord-bg-primary text-discord-brand-green",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C6.486 2 2 6.486 2 12C2 17.514 6.486 22 12 22C17.514 22 22 17.514 22 12C22 6.486 17.514 2 12 2ZM12 20C7.589 20 4 16.411 4 12C4 7.589 7.589 4 12 4C16.411 4 20 7.589 20 12C20 16.411 16.411 20 12 20Z"
            fill="currentColor"
          />
          <path
            d="M9.305 16.071L15.629 13.629L13.187 7.305L6.863 9.747L9.305 16.071ZM11.281 11.281C11.681 10.881 12.319 10.881 12.719 11.281C13.119 11.681 13.119 12.319 12.719 12.719C12.319 13.119 11.681 13.119 11.281 12.719C10.881 12.319 10.881 11.681 11.281 11.281Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </Tooltip>
  );
}
