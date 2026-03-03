"use client";

import { cn } from "@/shared/lib/legacy/cn";

export function EphemeralBanner({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className={cn("mt-1 flex items-center gap-2 text-xs text-discord-text-muted italic")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M12 5C5.648 5 1 12 1 12s4.648 7 11 7 11-7 11-7-4.648-7-11-7zm0 12c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>このメッセージはあなただけに表示されています</span>
      {onDismiss && (
        <>
          <span className="text-discord-text-muted">-</span>
          <button onClick={onDismiss} className="text-discord-text-link hover:underline">
            メッセージを非表示
          </button>
        </>
      )}
    </div>
  );
}

export function isEphemeral(flags?: number): boolean {
  return ((flags ?? 0) & 64) === 64;
}
