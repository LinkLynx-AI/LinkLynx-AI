"use client";

import { X, File, EyeOff, Image } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type FilePreviewCardProps = {
  file: {
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  };
  onRemove: () => void;
  onToggleSpoiler?: () => void;
  isSpoiler?: boolean;
  altText?: string;
  onAltTextChange?: (text: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

export function FilePreviewCard({
  file,
  onRemove,
  onToggleSpoiler,
  isSpoiler = false,
  altText,
  onAltTextChange,
}: FilePreviewCardProps) {
  const isImage = isImageType(file.type);

  return (
    <div
      className={cn(
        "relative flex w-[120px] shrink-0 flex-col overflow-hidden rounded-lg",
        "border border-discord-bg-mod-faint bg-discord-bg-secondary",
      )}
    >
      {/* Preview area */}
      <div className="relative flex h-[80px] items-center justify-center bg-discord-bg-tertiary">
        {isImage && file.previewUrl ? (
          <img
            src={file.previewUrl}
            alt={altText || file.name}
            className={cn("h-full w-full object-cover", isSpoiler && "blur-xl")}
          />
        ) : (
          <File className="h-8 w-8 text-discord-text-muted" />
        )}

        {/* Spoiler badge */}
        {isSpoiler && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-xs font-semibold text-white">スポイラー</span>
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "absolute right-1 top-1 rounded-full bg-discord-bg-floating p-0.5",
            "text-discord-interactive-normal hover:text-discord-danger",
            "transition-colors",
          )}
          aria-label="ファイルを削除"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Spoiler toggle */}
        {isImage && onToggleSpoiler && (
          <button
            type="button"
            onClick={onToggleSpoiler}
            className={cn(
              "absolute left-1 top-1 rounded-full bg-discord-bg-floating p-0.5",
              "text-discord-interactive-normal hover:text-discord-interactive-hover",
              "transition-colors",
              isSpoiler && "text-discord-brand",
            )}
            aria-label={isSpoiler ? "スポイラー解除" : "スポイラーにする"}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* File info */}
      <div className="flex flex-col gap-1 p-1.5">
        <span className="truncate text-xs text-discord-text-normal" title={file.name}>
          {file.name}
        </span>
        <span className="text-[10px] text-discord-text-muted">{formatFileSize(file.size)}</span>

        {/* Alt text input for images */}
        {isImage && onAltTextChange && (
          <div className="mt-0.5 flex items-center gap-1">
            <Image className="h-3 w-3 shrink-0 text-discord-text-muted" />
            <input
              type="text"
              value={altText || ""}
              onChange={(e) => onAltTextChange(e.target.value)}
              placeholder="ALT"
              className={cn(
                "min-w-0 flex-1 rounded bg-discord-input-bg px-1 py-0.5",
                "text-[10px] text-discord-text-normal outline-none",
                "placeholder:text-discord-text-muted",
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
