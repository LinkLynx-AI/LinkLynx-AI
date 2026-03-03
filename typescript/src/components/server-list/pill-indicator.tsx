"use client";

import { cn } from "@/lib/cn";

export function PillIndicator({
  state,
}: {
  state: "none" | "unread" | "hover" | "selected";
}) {
  if (state === "none") return null;

  return (
    <span
      className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all duration-200",
        state === "unread" && "h-2",
        state === "hover" && "h-5",
        state === "selected" && "h-10"
      )}
    />
  );
}
