"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { ContextMenu } from "@/shared/ui/legacy/context-menu";

export function SubMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <div
      ref={itemRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={cn(
          "mx-1.5 flex w-[calc(100%-12px)] items-center rounded-sm px-2 py-1.5 text-sm text-left transition-colors",
          "text-discord-interactive-normal hover:bg-discord-brand-blurple hover:text-white",
        )}
        role="menuitem"
      >
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-full top-0 z-50 ml-0.5">
          <ContextMenu>{children}</ContextMenu>
        </div>
      )}
    </div>
  );
}
