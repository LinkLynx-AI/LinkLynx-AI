"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function ImageLightboxModal({
  onClose,
  src,
  alt,
  filename,
}: {
  onClose: () => void;
  src?: string;
  alt?: string;
  filename?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt ?? filename ?? "Image"}
        className="max-h-[80vh] max-w-[90vw] object-contain"
      />
      {filename && (
        <div className="mt-2 flex items-center gap-3 text-sm text-white/70">
          <span>{filename}</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-discord-text-link hover:underline"
          >
            ブラウザで開く
          </a>
        </div>
      )}
    </div>
  );
}
