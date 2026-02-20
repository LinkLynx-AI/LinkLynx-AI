import type { ThemeMode } from "../model/types";
import { classNames } from "@/shared";

type ThemeToggleButtonProps = {
  currentTheme: ThemeMode;
  onToggle?: () => void;
  disabled?: boolean;
};

export function ThemeToggleButton({
  currentTheme,
  onToggle,
  disabled = false,
}: ThemeToggleButtonProps) {
  const nextThemeLabel = currentTheme === "dark" ? "ライト" : "ダーク";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={classNames(
        "rounded-md border border-white/20 px-3 py-1 text-sm font-medium",
        "transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      テーマ: {currentTheme === "dark" ? "ダーク" : "ライト"}
      <span className="ml-2 text-xs text-white/70">次: {nextThemeLabel}</span>
    </button>
  );
}
