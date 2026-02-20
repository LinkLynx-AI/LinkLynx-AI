"use client";

import { useEffect } from "react";

type ToastVariant = "info" | "success" | "warning" | "error";

type ToastProps = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  onClose?: () => void;
  autoCloseMs?: number;
};

const variantClassMap: Record<ToastVariant, string> = {
  info: "border-discord-primary bg-discord-primary/10",
  success: "border-discord-green bg-discord-green/10",
  warning: "border-discord-yellow bg-discord-yellow/10",
  error: "border-discord-red bg-discord-red/10",
};

export function Toast({
  title,
  description,
  variant = "info",
  onClose,
  autoCloseMs,
}: ToastProps) {
  useEffect(() => {
    if (!onClose || typeof autoCloseMs !== "number" || autoCloseMs <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, autoCloseMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoCloseMs, onClose]);

  return (
    <article
      role="status"
      aria-live="polite"
      className={`rounded-lg border px-4 py-3 text-sm text-white shadow-sm ${variantClassMap[variant]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 text-white/75">{description}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="トーストを閉じる"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-white/80 transition hover:bg-white/10"
          >
            ×
          </button>
        ) : null}
      </div>
    </article>
  );
}
