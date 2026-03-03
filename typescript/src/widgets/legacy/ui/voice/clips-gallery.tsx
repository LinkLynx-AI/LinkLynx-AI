"use client";

import { Play, Share2, Trash2, Film } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { Tooltip } from "@/shared/ui/legacy/tooltip";

export type ClipItem = {
  id: string;
  duration: number;
  timestamp: string;
  thumbnailUrl?: string;
  channelName: string;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const mockClips: ClipItem[] = [
  { id: "clip-1", duration: 15, timestamp: "2分前", channelName: "一般ボイス" },
  { id: "clip-2", duration: 28, timestamp: "10分前", channelName: "ゲーム部屋" },
  { id: "clip-3", duration: 8, timestamp: "1時間前", channelName: "一般ボイス" },
  { id: "clip-4", duration: 22, timestamp: "3時間前", channelName: "音楽" },
];

export function ClipsGallery({
  clips = mockClips,
  onPlay,
  onDelete,
  onShare,
}: {
  clips?: ClipItem[];
  onPlay?: (clipId: string) => void;
  onDelete?: (clipId: string) => void;
  onShare?: (clipId: string) => void;
}) {
  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Film className="mb-3 h-10 w-10 text-discord-text-muted" />
        <p className="text-sm text-discord-text-muted">クリップはまだありません</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
      {clips.map((clip) => (
        <div
          key={clip.id}
          className="group overflow-hidden rounded-lg border border-discord-divider bg-discord-bg-secondary transition-colors hover:bg-discord-bg-tertiary"
        >
          {/* Thumbnail */}
          <div className="relative h-24 w-full bg-gradient-to-br from-discord-brand-blurple/20 to-purple-600/10">
            {clip.thumbnailUrl && (
              <img
                src={clip.thumbnailUrl}
                alt={`${clip.channelName}のクリップ`}
                className="h-full w-full object-cover"
              />
            )}
            {/* Duration overlay */}
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium tabular-nums text-white">
              {formatDuration(clip.duration)}
            </span>
            {/* Play overlay */}
            <button
              onClick={() => onPlay?.(clip.id)}
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity",
                "group-hover:opacity-100",
              )}
              aria-label="再生"
            >
              <Play className="h-8 w-8 text-white" fill="white" />
            </button>
          </div>

          {/* Info */}
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-discord-text-normal">
                {clip.channelName}
              </p>
              <p className="text-[10px] text-discord-text-muted">{clip.timestamp}</p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip content="共有" position="top">
                <button
                  onClick={() => onShare?.(clip.id)}
                  className="flex h-6 w-6 items-center justify-center rounded text-discord-interactive-normal opacity-0 transition-opacity hover:text-discord-interactive-hover group-hover:opacity-100"
                  aria-label="共有"
                >
                  <Share2 className="h-3 w-3" />
                </button>
              </Tooltip>
              <Tooltip content="削除" position="top">
                <button
                  onClick={() => onDelete?.(clip.id)}
                  className="flex h-6 w-6 items-center justify-center rounded text-discord-interactive-normal opacity-0 transition-opacity hover:text-discord-btn-danger group-hover:opacity-100"
                  aria-label="削除"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
