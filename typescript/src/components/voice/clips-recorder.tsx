"use client";

import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ClipsRecorder({
  onStartRecording,
  onStopRecording,
  isRecording,
  duration = 0,
}: {
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  duration?: number;
}) {
  const maxDuration = 30;

  return (
    <div className="flex items-center gap-1">
      <Tooltip content={isRecording ? "録画停止" : "クリップを録画"}>
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            isRecording
              ? "bg-discord-btn-danger text-white"
              : "bg-discord-bg-tertiary text-discord-interactive-normal hover:text-discord-interactive-hover"
          )}
          aria-label={isRecording ? "録画停止" : "クリップを録画"}
        >
          <Clapperboard className="h-5 w-5" />
        </button>
      </Tooltip>

      {isRecording && (
        <div className="flex items-center gap-1.5 rounded-full bg-discord-btn-danger/20 px-2.5 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-discord-btn-danger" />
          <span className="text-xs font-medium tabular-nums text-discord-btn-danger">
            {formatDuration(duration)}
          </span>
          <span className="text-[10px] text-discord-text-muted">
            / {formatDuration(maxDuration)}
          </span>
        </div>
      )}
    </div>
  );
}
