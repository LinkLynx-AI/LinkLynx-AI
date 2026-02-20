"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";

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

export function getDuration(autoCloseMs?: number): number {
  if (typeof autoCloseMs === "number" && autoCloseMs > 0) {
    return autoCloseMs;
  }

  return Number.POSITIVE_INFINITY;
}

export function Toast({ title, description, variant = "info", onClose, autoCloseMs }: ToastProps) {
  const duration = getDuration(autoCloseMs);

  return (
    <ToastPrimitive.Provider duration={duration} swipeDirection="right">
      <ToastPrimitive.Root
        key={`${title}-${description ?? ""}-${variant}-${duration}`}
        role="status"
        aria-live="polite"
        defaultOpen
        duration={duration}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose?.();
          }
        }}
        className={`rounded-lg border px-4 py-3 text-sm text-white shadow-sm ${variantClassMap[variant]}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <ToastPrimitive.Title className="font-semibold">{title}</ToastPrimitive.Title>
            {description ? (
              <ToastPrimitive.Description className="mt-1 text-white/75">
                {description}
              </ToastPrimitive.Description>
            ) : null}
          </div>

          {onClose ? (
            <ToastPrimitive.Close asChild>
              <button
                type="button"
                aria-label="トーストを閉じる"
                className="rounded px-2 py-1 text-xs text-white/80 transition hover:bg-white/10"
              >
                ×
              </button>
            </ToastPrimitive.Close>
          ) : null}
        </div>
      </ToastPrimitive.Root>
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
