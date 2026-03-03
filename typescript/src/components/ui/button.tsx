"use client";

import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-discord-brand-blurple text-white hover:bg-discord-btn-blurple-hover active:bg-discord-btn-blurple-active",
  secondary:
    "bg-discord-btn-secondary-bg text-white hover:bg-discord-btn-secondary-hover active:bg-discord-btn-secondary-active",
  success: "bg-discord-btn-success text-white hover:bg-discord-btn-success-hover",
  danger: "bg-discord-btn-danger text-white hover:bg-discord-btn-danger-hover",
  link: "bg-transparent text-discord-text-link hover:underline",
};

const sizes = {
  sm: "h-8 text-sm px-3",
  md: "h-10 text-sm px-4",
  lg: "h-11 text-base px-6",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[3px] font-medium transition-colors",
        variants[variant],
        sizes[size],
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
