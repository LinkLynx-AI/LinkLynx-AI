"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
};

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}

export function Modal({
  open,
  title,
  description,
  children,
  actions,
  onClose,
}: ModalProps) {
  const dialogId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);
    const initialFocusTarget = focusableElements[0] ?? dialogRef.current;
    initialFocusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusTargets = getFocusableElements(dialogRef.current);
      if (focusTargets.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstTarget = focusTargets[0];
      const lastTarget = focusTargets[focusTargets.length - 1];

      if (event.shiftKey && document.activeElement === firstTarget) {
        event.preventDefault();
        lastTarget?.focus();
      }

      if (!event.shiftKey && document.activeElement === lastTarget) {
        event.preventDefault();
        firstTarget?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div
      data-testid="modal-overlay"
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={handleOverlayClick}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-lg rounded-xl border border-white/20 bg-discord-darker p-6 shadow-2xl"
      >
        <header className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <h2 id={dialogId} className="text-lg font-semibold text-white">
              {title}
            </h2>
            {onClose ? (
              <button
                type="button"
                aria-label="閉じる"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            ) : null}
          </div>
          {description ? (
            <p id={descriptionId} className="text-sm text-white/70">
              {description}
            </p>
          ) : null}
        </header>
        {children ? <div className="mt-4 text-sm text-white/80">{children}</div> : null}
        {actions ? (
          <footer className="mt-6 flex justify-end gap-3">{actions}</footer>
        ) : null}
      </section>
    </div>
  );
}
