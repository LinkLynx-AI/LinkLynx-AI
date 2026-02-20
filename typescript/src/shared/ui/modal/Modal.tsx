import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
};

export function Modal({
  open,
  title,
  description,
  children,
  actions,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-xl border border-white/20 bg-discord-darker p-6 shadow-2xl"
      >
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description ? (
            <p className="text-sm text-white/70">{description}</p>
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
