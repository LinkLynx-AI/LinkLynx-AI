"use client";

import { useState, useRef } from "react";
import { cn } from "@/shared/lib/cn";

const positions = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({
  children,
  content,
  position = "top",
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: keyof typeof positions;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(null);

  const show = () => {
    timeout.current = setTimeout(() => setVisible(true), 100);
  };

  const hide = () => {
    if (timeout.current) clearTimeout(timeout.current);
    setVisible(false);
  };

  return (
    <div className={cn("relative inline-flex", className)} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-discord-bg-floating px-3 py-1.5 text-sm text-discord-text-normal shadow-lg",
            positions[position],
          )}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}
