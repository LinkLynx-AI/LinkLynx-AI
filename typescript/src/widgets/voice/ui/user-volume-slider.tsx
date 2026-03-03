"use client";

import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";

function getVolumeIcon(volume: number, isMuted: boolean) {
  if (isMuted || volume === 0) return VolumeX;
  if (volume < 50) return Volume;
  if (volume < 120) return Volume1;
  return Volume2;
}

export function UserVolumeSlider({
  displayName,
  volume,
  onChange,
  onMute,
  isMuted = false,
}: {
  userId: string;
  displayName: string;
  volume: number;
  onChange: (volume: number) => void;
  onMute?: () => void;
  isMuted?: boolean;
}) {
  const Icon = getVolumeIcon(volume, isMuted);

  return (
    <div className="flex items-center gap-2 rounded-md bg-discord-bg-secondary px-3 py-2">
      <button
        onClick={onMute}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded text-discord-interactive-normal transition-colors hover:text-discord-interactive-hover",
          isMuted && "text-discord-btn-danger",
        )}
        aria-label={isMuted ? `${displayName}のミュートを解除` : `${displayName}をミュート`}
      >
        <Icon className="h-4 w-4" />
      </button>

      <span className="w-20 truncate text-sm text-discord-text-normal">{displayName}</span>

      <input
        type="range"
        min={0}
        max={200}
        value={isMuted ? 0 : volume}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-discord-bg-tertiary accent-discord-brand-blurple"
        aria-label={`${displayName}の音量`}
      />

      <span className="w-10 text-right text-xs tabular-nums text-discord-text-muted">
        {isMuted ? 0 : volume}%
      </span>
    </div>
  );
}
