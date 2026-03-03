"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";

export function VoiceQualitySettings({ onClose }: { onClose: () => void }) {
  const [resolution, setResolution] = useState("1080p");
  const [frameRate, setFrameRate] = useState("30");
  const [highQuality, setHighQuality] = useState(false);
  const [hwAccel, setHwAccel] = useState(true);

  return (
    <div className="w-64 rounded-lg border border-discord-divider bg-discord-bg-floating shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-discord-header-primary">配信画質</h3>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-discord-interactive-normal hover:text-discord-interactive-hover"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-3 pb-3">
        {/* Resolution */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-discord-text-muted">解像度</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="rounded bg-discord-bg-secondary px-2 py-1.5 text-sm text-discord-text-normal"
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="1440p">1440p</option>
            <option value="source">ソース</option>
          </select>
        </div>

        {/* Frame rate */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-discord-text-muted">フレームレート</label>
          <select
            value={frameRate}
            onChange={(e) => setFrameRate(e.target.value)}
            className="rounded bg-discord-bg-secondary px-2 py-1.5 text-sm text-discord-text-normal"
          >
            <option value="15">15fps</option>
            <option value="30">30fps</option>
            <option value="60">60fps</option>
          </select>
        </div>

        {/* High quality toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-discord-text-normal">高品質の優先</span>
          <button
            role="switch"
            aria-checked={highQuality}
            onClick={() => setHighQuality(!highQuality)}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              highQuality ? "bg-discord-btn-success" : "bg-discord-bg-tertiary",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                highQuality && "translate-x-4",
              )}
            />
          </button>
        </div>

        {/* Hardware acceleration toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-discord-text-normal">ハードウェアアクセラレーション</span>
          <button
            role="switch"
            aria-checked={hwAccel}
            onClick={() => setHwAccel(!hwAccel)}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              hwAccel ? "bg-discord-btn-success" : "bg-discord-bg-tertiary",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                hwAccel && "translate-x-4",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
