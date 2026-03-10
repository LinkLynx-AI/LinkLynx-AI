"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/shared/lib/cn";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";

export type CroppedImageResult = {
  file: File;
  url: string;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  if (typeof canvas.toBlob !== "function") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type);
  });
}

function resolveCropMimeType(file: File): string {
  return file.type.startsWith("image/") ? file.type : "image/png";
}

function resolveCropExtension(type: string): string {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

function buildCroppedFileName(file: File, type: string): string {
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return `${baseName || "image"}-cropped.${resolveCropExtension(type)}`;
}

export function ImageCropModal({
  imageUrl,
  sourceFile,
  shape,
  aspectRatio,
  onCrop,
  onClose,
}: {
  imageUrl: string;
  sourceFile: File;
  shape: "circle" | "rectangle";
  aspectRatio?: number;
  onCrop: (result: CroppedImageResult) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      posStart.current = { ...position };
    },
    [position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy,
      });
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleApply = async () => {
    const image = imageRef.current;
    if (image === null) {
      onCrop({
        file: sourceFile,
        url: imageUrl,
      });
      return;
    }

    setIsApplying(true);
    try {
      if (typeof image.decode === "function" && image.complete === false) {
        try {
          await image.decode();
        } catch {
          // decode に失敗しても fallback 可能なら続行する。
        }
      }

      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        onCrop({
          file: sourceFile,
          url: imageUrl,
        });
        return;
      }

      const cropWidth = shape === "circle" ? 200 : 300;
      const cropHeight = aspectRatio ? cropWidth / aspectRatio : cropWidth;
      const outputScale = Math.max(1, window.devicePixelRatio || 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(cropWidth * outputScale);
      canvas.height = Math.round(cropHeight * outputScale);

      let context: CanvasRenderingContext2D | null = null;
      try {
        context = canvas.getContext("2d");
      } catch {
        context = null;
      }
      if (context === null) {
        onCrop({
          file: sourceFile,
          url: imageUrl,
        });
        return;
      }

      const baseScale = Math.max(cropWidth / image.naturalWidth, cropHeight / image.naturalHeight);
      const drawWidth = image.naturalWidth * baseScale;
      const drawHeight = image.naturalHeight * baseScale;
      const drawX = (cropWidth - drawWidth) / 2;
      const drawY = (cropHeight - drawHeight) / 2;

      context.scale(outputScale, outputScale);
      context.translate(position.x, position.y);
      context.translate(cropWidth / 2, cropHeight / 2);
      context.scale(zoom / 100, zoom / 100);
      context.translate(-cropWidth / 2, -cropHeight / 2);
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const mimeType = resolveCropMimeType(sourceFile);
      const blob = await canvasToBlob(canvas, mimeType);
      if (blob === null) {
        onCrop({
          file: sourceFile,
          url: imageUrl,
        });
        return;
      }

      onCrop({
        file: new File([blob], buildCroppedFileName(sourceFile, mimeType), {
          type: mimeType,
        }),
        url: URL.createObjectURL(blob),
      });
    } finally {
      setIsApplying(false);
    }
  };

  const cropSize = shape === "circle" ? 200 : 300;
  const cropHeight = aspectRatio ? cropSize / aspectRatio : cropSize;

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <ModalHeader>画像を編集</ModalHeader>
      <ModalBody>
        {/* Crop area */}
        <div
          className="relative mx-auto overflow-hidden bg-black/80"
          style={{ width: cropSize, height: cropHeight }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Image */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Crop preview"
            className="absolute select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom / 100})`,
              transformOrigin: "center",
              cursor: dragging ? "grabbing" : "grab",
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            draggable={false}
          />

          {/* Crop mask overlay */}
          {shape === "circle" && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle ${cropSize / 2}px at center, transparent ${cropSize / 2 - 1}px, rgba(0,0,0,0.6) ${cropSize / 2}px)`,
              }}
            />
          )}

          {/* Crop border */}
          <div
            className={cn(
              "pointer-events-none absolute inset-2 border-2 border-white/50",
              shape === "circle" ? "rounded-full" : "rounded-sm",
            )}
          />
        </div>

        {/* Zoom slider */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-discord-text-muted">50%</span>
          <input
            type="range"
            min={50}
            max={200}
            step={1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-discord-brand-blurple"
            aria-label="ズーム"
          />
          <span className="text-xs text-discord-text-muted">200%</span>
          <span className="min-w-[40px] text-right text-sm text-discord-text-normal">{zoom}%</span>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button variant="primary" onClick={() => void handleApply()} disabled={isApplying}>
          {isApplying ? "適用中..." : "適用"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
