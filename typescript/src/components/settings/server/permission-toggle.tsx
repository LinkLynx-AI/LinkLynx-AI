"use client";

import { cn } from "@/lib/cn";
import { Check, X, Minus } from "lucide-react";

type PermissionState = "allow" | "deny" | "inherit";

const stateConfig = {
  allow: {
    label: "許可",
    icon: Check,
    bg: "bg-discord-brand-green",
    text: "text-white",
  },
  inherit: {
    label: "継承",
    icon: Minus,
    bg: "bg-discord-interactive-muted",
    text: "text-white",
  },
  deny: {
    label: "拒否",
    icon: X,
    bg: "bg-discord-brand-red",
    text: "text-white",
  },
} as const;

export function PermissionToggle({
  value,
  onChange,
  label,
  description,
}: {
  value: PermissionState;
  onChange: (value: PermissionState) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-discord-divider py-3">
      <div className="flex-1 pr-4">
        <span className="text-sm text-discord-text-normal">{label}</span>
        {description && <p className="mt-0.5 text-xs text-discord-text-muted">{description}</p>}
      </div>
      <div className="flex gap-0.5 rounded-[3px] bg-discord-bg-tertiary p-0.5">
        {(["allow", "inherit", "deny"] as const).map((state) => {
          const config = stateConfig[state];
          const Icon = config.icon;
          const isActive = value === state;
          return (
            <button
              key={state}
              onClick={() => onChange(state)}
              aria-label={config.label}
              className={cn(
                "flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                isActive
                  ? cn(config.bg, config.text)
                  : "text-discord-text-muted hover:text-discord-text-normal",
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
