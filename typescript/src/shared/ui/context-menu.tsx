"use client";

import { cn } from "@/shared/lib/cn";

export function ContextMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("min-w-[188px] rounded-lg bg-discord-bg-floating py-1.5 shadow-xl", className)}
      role="menu"
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  danger,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      className={cn(
        "mx-1.5 flex w-[calc(100%-12px)] items-center rounded-sm px-2 py-1.5 text-sm text-left transition-colors",
        danger
          ? "text-discord-brand-red hover:bg-discord-brand-red hover:text-white"
          : "text-discord-interactive-normal hover:bg-discord-brand-blurple hover:text-white",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className,
      )}
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <div className={cn("mx-1 my-1 h-px bg-discord-divider", className)} />;
}

export function MenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-2 py-1 text-xs font-bold uppercase text-discord-text-muted", className)}>
      {children}
    </div>
  );
}
