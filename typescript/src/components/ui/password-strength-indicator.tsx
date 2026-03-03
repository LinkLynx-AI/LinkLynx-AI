"use client";

import { cn } from "@/lib/cn";

function getStrength(password: string): {
  level: number;
  label: string;
  color: string;
} {
  if (password.length === 0) {
    return { level: 0, label: "", color: "" };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (password.length >= 12 && hasUpper && hasLower && hasNumber && hasSpecial) {
    return { level: 4, label: "とても強い", color: "bg-discord-brand-green" };
  }
  if (password.length >= 8 && hasUpper && hasLower && hasNumber) {
    return { level: 3, label: "強い", color: "bg-yellow-500" };
  }
  if (password.length >= 8) {
    return { level: 2, label: "普通", color: "bg-orange-500" };
  }
  return { level: 1, label: "弱い", color: "bg-discord-brand-red" };
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { level, label, color } = getStrength(password);

  if (level === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              segment <= level ? color : "bg-discord-bg-modifier-accent",
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          "mt-1 text-xs",
          level <= 1
            ? "text-discord-brand-red"
            : level === 2
              ? "text-orange-500"
              : level === 3
                ? "text-yellow-500"
                : "text-discord-brand-green",
        )}
      >
        {label}
      </p>
    </div>
  );
}
