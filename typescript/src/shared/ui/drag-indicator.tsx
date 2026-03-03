"use client";

import { cn } from "@/shared/lib/cn";

export function DragIndicator({
  visible,
  position = "top",
  className,
}: {
  visible: boolean;
  position?: "top" | "bottom";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-0 right-0 z-10 flex items-center transition-opacity duration-150",
        position === "top" ? "-top-px" : "-bottom-px",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <div className="h-2 w-2 rounded-full bg-discord-brand-blurple" />
      <div className="h-0.5 flex-1 bg-discord-brand-blurple" />
      <div className="h-2 w-2 rounded-full bg-discord-brand-blurple" />
    </div>
  );
}
