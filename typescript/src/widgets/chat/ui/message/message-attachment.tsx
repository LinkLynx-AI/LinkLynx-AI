"use client";

import { useState } from "react";
import { FileIcon, Download } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { Attachment } from "@/shared/model/types/message";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isImage(contentType: string | null): boolean {
  return contentType?.startsWith("image/") ?? false;
}

export function MessageAttachment({ attachment }: { attachment: Attachment }) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  if (isImage(attachment.contentType)) {
    return (
      <div className="relative mt-1 inline-block max-w-[400px]">
        {attachment.spoiler && !spoilerRevealed && (
          <button
            onClick={() => setSpoilerRevealed(true)}
            className="absolute inset-0 z-10 flex items-center justify-center rounded bg-discord-bg-tertiary"
          >
            <span className="rounded bg-discord-bg-floating/80 px-3 py-1.5 text-sm font-bold text-white">
              SPOILER
            </span>
          </button>
        )}
        <img
          src={attachment.url}
          alt={attachment.filename}
          className={cn(
            "max-h-[300px] rounded",
            attachment.spoiler && !spoilerRevealed && "blur-[44px]",
          )}
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
        />
      </div>
    );
  }

  return (
    <div className="mt-1 flex max-w-[400px] items-center gap-3 rounded-lg border border-discord-bg-accent/40 bg-discord-bg-secondary p-3">
      <FileIcon className="h-10 w-10 shrink-0 text-discord-interactive-normal" />
      <div className="min-w-0 flex-1">
        <a
          href={attachment.url}
          className="block truncate text-sm font-medium text-discord-text-link hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {attachment.filename}
        </a>
        <span className="text-xs text-discord-text-muted">{formatFileSize(attachment.size)}</span>
      </div>
      <a
        href={attachment.url}
        download={attachment.filename}
        className="shrink-0 text-discord-interactive-normal hover:text-discord-interactive-hover"
      >
        <Download className="h-5 w-5" />
      </a>
    </div>
  );
}
