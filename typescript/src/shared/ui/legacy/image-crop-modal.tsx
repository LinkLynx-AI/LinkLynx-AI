"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/legacy/modal";
import { Button } from "@/shared/ui/legacy/button";

export function ImageCropModal({
  imageUrl,
  shape,
  aspectRatio,
  onCrop,
  onClose,
}: {
  imageUrl: string;
  shape: "circle" | "rectangle";
  aspectRatio?: number;
  onCrop: (croppedUrl: string) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

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

  const handleApply = () => {
    // In a real implementation, this would use canvas to crop the image
    // For now, pass through the original URL
    onCrop(imageUrl);
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
        <Button variant="primary" onClick={handleApply}>
          適用
        </Button>
      </ModalFooter>
    </Modal>
  );
}
