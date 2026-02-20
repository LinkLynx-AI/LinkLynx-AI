"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
};

export function Modal({ open, title, description, children, actions, onClose }: ModalProps) {
  const resolvedDescription = description ?? `${title} dialog`;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose?.();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay data-testid="modal-overlay" className="fixed inset-0 z-20 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-30 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/20 bg-discord-darker p-6 shadow-2xl">
          <header className="space-y-1">
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold text-white">{title}</Dialog.Title>
              {onClose ? (
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="閉じる"
                    className="rounded-md px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    ×
                  </button>
                </Dialog.Close>
              ) : null}
            </div>
            <Dialog.Description className={description ? "text-sm text-white/70" : "sr-only"}>
              {resolvedDescription}
            </Dialog.Description>
          </header>

          {children ? <div className="mt-4 text-sm text-white/80">{children}</div> : null}

          {actions ? <footer className="mt-6 flex justify-end gap-3">{actions}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
