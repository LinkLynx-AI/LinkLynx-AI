"use client";

import { useState, useCallback, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";

export function FileDropZone({
  channelId,
  children,
  onFilesDropped,
}: {
  channelId: string;
  children: React.ReactNode;
  onFilesDropped?: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const openModal = useUIStore((s) => s.openModal);
  const dragCounterRef = { current: 0 };

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      dragCounterRef.current = 0;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        if (onFilesDropped) {
          onFilesDropped(files);
        } else {
          openModal("file-upload", { channelId, files });
        }
      }
    },
    [channelId, openModal, onFilesDropped],
  );

  return (
    <div
      className="relative flex flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {dragging && (
        <div
          className={cn(
            "absolute inset-0 z-50",
            "flex flex-col items-center justify-center gap-4",
            "bg-discord-brand/20 backdrop-blur-sm",
            "border-2 border-dashed border-discord-brand",
            "rounded-lg",
          )}
        >
          <Upload className="h-12 w-12 text-discord-brand" />
          <p className="text-lg font-semibold text-discord-text-normal">
            ファイルをドロップしてアップロード
          </p>
        </div>
      )}
    </div>
  );
}
