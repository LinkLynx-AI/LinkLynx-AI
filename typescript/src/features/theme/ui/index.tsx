import type { ThemeMode } from "../model";

type ThemeModeChipProps = {
  mode: ThemeMode;
};

/**
 * 現在のテーマモードを表示する。
 */
export function ThemeModeChip({ mode }: ThemeModeChipProps) {
  return (
    <span className="rounded-full border border-discord-primary/30 px-3 py-1 text-xs text-discord-primary">
      Theme: {mode}
    </span>
  );
}
