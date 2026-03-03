"use client";

import { cn } from "@/shared/lib/cn";
import { ImageDown, X } from "lucide-react";

type ImageCompressDialogProps = {
  filename: string;
  originalSize: number;
  onCompress: () => void;
  onKeepOriginal: () => void;
  onClose: () => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageCompressDialog({
  filename,
  originalSize,
  onCompress,
  onKeepOriginal,
  onClose,
}: ImageCompressDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className={cn(
          "relative w-full max-w-sm rounded-lg bg-discord-bg-floating p-5 shadow-xl",
          "border border-discord-bg-mod-faint",
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute right-3 top-3 rounded p-1",
            "text-discord-interactive-normal hover:text-discord-interactive-hover",
            "transition-colors",
          )}
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-4">
          <ImageDown className="h-10 w-10 text-discord-brand" />

          <div className="text-center">
            <h3 className="text-lg font-semibold text-discord-text-normal">画像を圧縮しますか？</h3>
            <p className="mt-1 text-sm text-discord-text-muted">
              {filename} ({formatFileSize(originalSize)})
            </p>
          </div>

          <p className="text-center text-sm text-discord-text-muted">
            ファイルサイズを小さくして送信速度を上げることができます。
          </p>

          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={onKeepOriginal}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium",
                "bg-discord-bg-secondary text-discord-text-normal",
                "hover:bg-discord-bg-mod-hover transition-colors",
              )}
            >
              元のまま送信
            </button>
            <button
              type="button"
              onClick={onCompress}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium",
                "bg-discord-brand text-white",
                "hover:bg-discord-brand-hover transition-colors",
              )}
            >
              圧縮して送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
