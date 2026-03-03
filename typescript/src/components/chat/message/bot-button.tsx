"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ButtonComponent } from "@/types/bot-components";

const styleClasses: Record<string, string> = {
  primary:
    "bg-discord-brand-blurple text-white hover:bg-discord-btn-blurple-hover active:bg-discord-btn-blurple-active",
  secondary:
    "bg-discord-btn-secondary-bg text-white hover:bg-discord-btn-secondary-hover active:bg-discord-btn-secondary-active",
  success:
    "bg-discord-btn-success text-white hover:bg-discord-btn-success-hover",
  danger: "bg-discord-btn-danger text-white hover:bg-discord-btn-danger-hover",
  link: "bg-transparent text-discord-text-link hover:underline",
};

export function BotButton({
  component,
  onClick,
}: {
  component: ButtonComponent;
  onClick?: (customId: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (component.disabled || loading) return;

    if (component.style === "link" && component.url) {
      window.open(component.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (component.customId && onClick) {
      setLoading(true);
      onClick(component.customId);
      setTimeout(() => setLoading(false), 1000);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={component.disabled || loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-sm font-medium transition-colors",
        styleClasses[component.style] ?? styleClasses.secondary,
        (component.disabled || loading) &&
          "cursor-not-allowed opacity-50 pointer-events-none"
      )}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          data-testid="bot-button-spinner"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {component.emoji && (
        <span>{component.emoji.name}</span>
      )}
      {component.label && <span>{component.label}</span>}
      {component.style === "link" && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="ml-0.5"
        >
          <path d="M10 5V3H5.375C4.06519 3 3 4.06519 3 5.375V18.625C3 19.936 4.06519 21 5.375 21H18.625C19.936 21 21 19.936 21 18.625V14H19V19H5V5H10Z" />
          <path d="M21 2.99902H14V4.99902H17.586L9.29297 13.292L10.707 14.706L19 6.41302V9.99902H21V2.99902Z" />
        </svg>
      )}
    </button>
  );
}
