"use client";

import { cn } from "@/lib/cn";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

type ConnectionStatus = "connecting" | "disconnected" | "reconnecting";

const statusConfig: Record<
  ConnectionStatus,
  { icon: typeof Wifi; label: string; bg: string; text: string }
> = {
  connecting: {
    icon: Loader2,
    label: "接続中...",
    bg: "bg-discord-status-idle",
    text: "text-white",
  },
  disconnected: {
    icon: WifiOff,
    label: "接続が切断されました",
    bg: "bg-discord-status-dnd",
    text: "text-white",
  },
  reconnecting: {
    icon: Loader2,
    label: "再接続中...",
    bg: "bg-discord-status-idle",
    text: "text-white",
  },
};

export function ConnectionBanner({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === "connecting" || status === "reconnecting";

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium",
        config.bg,
        config.text,
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon
        className={cn("h-4 w-4", isAnimated && "animate-spin")}
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </div>
  );
}
