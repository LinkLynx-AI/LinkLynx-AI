"use client";

import { cn } from "@/lib/cn";
import { FilePreviewCard } from "./file-preview-card";

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  isSpoiler?: boolean;
}

interface FileUploadAreaProps {
  files: FileItem[];
  onRemove: (index: number) => void;
  onReorder?: (from: number, to: number) => void;
  onToggleSpoiler?: (index: number) => void;
}

export function FileUploadArea({
  files,
  onRemove,
  onToggleSpoiler,
}: FileUploadAreaProps) {
  if (files.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto px-3 pt-2",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-discord-bg-mod-faint"
      )}
    >
      {files.map((file, index) => (
        <FilePreviewCard
          key={file.id}
          file={file}
          onRemove={() => onRemove(index)}
          onToggleSpoiler={onToggleSpoiler ? () => onToggleSpoiler(index) : undefined}
          isSpoiler={file.isSpoiler}
        />
      ))}
    </div>
  );
}
