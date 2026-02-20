import { classNames } from "@/shared";

export const themeModes = ["light", "dark"] as const;

export type ThemeMode = (typeof themeModes)[number];

type ThemeToggleButtonProps = {
  currentTheme: ThemeMode;
  onToggle?: () => void;
  disabled?: boolean;
};

/**
 * テーマ切替UIの見た目を共通化したボタンを描画する。
 *
 * Contract:
 * - `currentTheme` は `light` または `dark`
 * - `disabled` 時は見た目のみ表示し、操作を受け付けない
 */
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
