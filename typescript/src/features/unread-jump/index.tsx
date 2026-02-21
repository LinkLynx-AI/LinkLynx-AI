"use client";

import { classNames } from "@/shared";

type UnreadJumpButtonProps = {
  isAtBottom: boolean;
  unreadCount: number;
  onJumpToLatest?: () => void;
};

/**
 * 新着ジャンプ導線の表示可否を判定する。
 *
 * Contract:
 * - `isAtBottom=false` かつ `unreadCount>0` のときだけ `true`
 */
export function shouldShowUnreadJump(isAtBottom: boolean, unreadCount: number): boolean {
  return !isAtBottom && unreadCount > 0;
}

/**
 * 未読件数に応じた下端ジャンプ導線を描画する。
 *
 * Contract:
 * - `shouldShowUnreadJump(...)` が `true` のときだけ表示する
 */
export function UnreadJumpButton({
  isAtBottom,
  unreadCount,
  onJumpToLatest,
}: UnreadJumpButtonProps) {
  if (!shouldShowUnreadJump(isAtBottom, unreadCount)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onJumpToLatest}
      className={classNames(
        "inline-flex w-fit items-center gap-2 rounded-full border border-discord-primary/70",
        "bg-discord-primary/20 px-4 py-2 text-sm font-semibold text-discord-primary transition hover:bg-discord-primary/30"
      )}
    >
      ↓ 新着{unreadCount}件を表示
    </button>
  );
}
