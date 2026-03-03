"use client";

import { CheckCircle, Info, X, XCircle } from "lucide-react";
import { cn } from "@/shared/lib/cn";

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const borderColors = {
  success: "border-l-green-500",
  error: "border-l-red-500",
  info: "border-l-discord-brand-blurple",
};

const iconColors = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-discord-brand-blurple",
};

export function Toast({
  id,
  message,
  type,
  onDismiss,
}: {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  onDismiss: (id: string) => void;
}) {
  const Icon = icons[type];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border-l-4 bg-discord-bg-floating px-4 py-3 shadow-lg",
        borderColors[type],
        "animate-slide-in-right",
      )}
      role="alert"
      onMouseEnter={(e) => e.currentTarget.setAttribute("data-hovered", "true")}
      onMouseLeave={(e) => e.currentTarget.removeAttribute("data-hovered")}
    >
      <Icon className={cn("h-5 w-5 shrink-0", iconColors[type])} />
      <p className="flex-1 text-sm text-discord-text-normal">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded p-1 text-discord-interactive-normal hover:text-discord-interactive-hover"
        aria-label="閉じる"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
