"use client";

import { Download, Share2, Trash2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type ClipData = {
  id: string;
  duration: number;
  timestamp: string;
  thumbnailUrl?: string;
};

export function ClipsPreviewCard({
  clip,
  onSave,
  onShare,
  onDelete,
}: {
  clip: ClipData;
  onSave: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="w-[200px] overflow-hidden rounded-lg border border-discord-divider bg-discord-bg-floating shadow-xl">
      {/* Thumbnail */}
      <div className="relative h-[112px] w-full bg-gradient-to-br from-discord-brand-blurple/30 to-purple-600/20">
        {clip.thumbnailUrl && (
          <img
            src={clip.thumbnailUrl}
            alt="クリッププレビュー"
            className="h-full w-full object-cover"
          />
        )}
        {/* Duration overlay */}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
          {formatDuration(clip.duration)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs text-discord-text-muted">{clip.timestamp}</span>
        <div className="flex items-center gap-1">
          <Tooltip content="保存" position="top">
            <button
              onClick={onSave}
              className="flex h-7 w-7 items-center justify-center rounded text-discord-interactive-normal transition-colors hover:text-discord-interactive-hover"
              aria-label="保存"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="共有" position="top">
            <button
              onClick={onShare}
              className="flex h-7 w-7 items-center justify-center rounded text-discord-interactive-normal transition-colors hover:text-discord-interactive-hover"
              aria-label="共有"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="削除" position="top">
            <button
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded text-discord-btn-danger transition-colors hover:text-discord-btn-danger/80"
              aria-label="削除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
