"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function NsfwBlur({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative overflow-hidden rounded", className)}>
      <div className="blur-xl pointer-events-none select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-discord-bg-secondary/80">
        <button
          onClick={() => setRevealed(true)}
          className={cn(
            "rounded-md bg-discord-bg-tertiary px-4 py-2 text-sm font-medium",
            "text-discord-text-normal hover:bg-discord-bg-mod-hover transition-colors",
          )}
        >
          表示する
        </button>
      </div>
    </div>
  );
}
