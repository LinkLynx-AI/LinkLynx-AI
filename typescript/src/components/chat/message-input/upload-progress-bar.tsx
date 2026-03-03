"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface UploadProgressBarProps {
  filename: string;
  progress: number;
  onCancel?: () => void;
}

export function UploadProgressBar({
  filename,
  progress,
  onCancel,
}: UploadProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex items-center gap-3 rounded-md bg-discord-bg-secondary px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-discord-text-normal">
            {filename}
          </span>
          <span className="shrink-0 text-xs text-discord-text-muted">
            {Math.round(clampedProgress)}%
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-discord-bg-mod-faint">
          <div
            className={cn(
              "h-full rounded-full bg-discord-brand transition-[width] duration-300 ease-out"
            )}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "shrink-0 rounded p-1",
            "text-discord-interactive-normal hover:text-discord-interactive-hover",
            "transition-colors"
          )}
          aria-label="アップロードをキャンセル"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
