"use client";

import { useEffect } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { AlertTriangle, Check } from "lucide-react";

export function InteractionOverlay({
  state,
  message,
  onRetry,
  onDismiss,
}: {
  state: "loading" | "failed" | "success";
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state, onDismiss]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center rounded",
        "bg-discord-bg-primary/80 backdrop-blur-[1px]",
      )}
    >
      {state === "loading" && (
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 animate-spin text-discord-text-muted"
            viewBox="0 0 24 24"
            fill="none"
            data-testid="interaction-spinner"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm text-discord-text-muted">{message ?? "処理中..."}</span>
        </div>
      )}
      {state === "failed" && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-discord-btn-danger" />
            <span className="text-sm text-discord-btn-danger">
              {message ?? "インタラクションに失敗しました"}
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded bg-discord-btn-danger px-3 py-1 text-xs font-medium text-white hover:bg-discord-btn-danger-hover transition-colors"
            >
              再試行
            </button>
          )}
        </div>
      )}
      {state === "success" && (
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-discord-btn-success" />
          <span className="text-sm text-discord-btn-success">{message ?? "完了"}</span>
        </div>
      )}
    </div>
  );
}
