import type { FormEvent, KeyboardEvent } from "react";
import { classNames } from "@/shared";

type MessageComposerProps = {
  value: string;
  canSubmit: boolean;
  onValueChange: (nextValue: string) => void;
  onSubmit: () => void;
};

export type ComposerEnterAction = "submit" | "newline" | "none";

export type ResolveComposerEnterActionInput = {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
};

/**
 * Enter キー入力を送信・改行・無視のいずれかに判定する。
 *
 * Contract:
 * - `Enter` + `Shift` は常に `newline`
 * - `Enter` 単押しは `submit`
 * - それ以外、または IME 変換中は `none`
 */
export function resolveComposerEnterAction({
  key,
  shiftKey,
  isComposing = false,
}: ResolveComposerEnterActionInput): ComposerEnterAction {
  if (key !== "Enter" || isComposing) {
    return "none";
  }

  return shiftKey ? "newline" : "submit";
}

/**
 * メッセージ入力欄の controlled UI を提供する。
 *
 * Contract:
 * - `value` は親で管理する controlled state
 * - `canSubmit=false` のとき送信ボタンと Enter 送信を無効化
 * - Enter/Shift+Enter の案内と入力モード表示は常時表示
 */
export function MessageComposer({
  value,
  canSubmit,
  onValueChange,
  onSubmit,
}: MessageComposerProps) {
  const composerModeLabel = value.includes("\n") ? "複数行入力" : "通常入力";

  const submitIfAvailable = () => {
    if (!canSubmit) {
      return;
    }

    onSubmit();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitIfAvailable();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const enterAction = resolveComposerEnterAction({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    });

    if (enterAction !== "submit") {
      return;
    }

    event.preventDefault();
    submitIfAvailable();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="message-composer-input" className="text-sm font-medium text-white/90">
        メッセージ
      </label>
      <textarea
        id="message-composer-input"
        value={value}
        rows={3}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="メッセージを入力"
        className={classNames(
          "w-full resize-y rounded-md border border-white/20 bg-discord-dark px-3 py-2 text-sm text-white",
          "placeholder:text-white/40 focus:border-white/40 focus:outline-none",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
        <p aria-live="polite">入力モード: {composerModeLabel}</p>
        <p>Enterで送信 / Shift+Enterで改行</p>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className={classNames(
            "rounded-md bg-discord-accent px-3 py-2 text-sm font-semibold text-white",
            "transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          送信
        </button>
      </div>
    </form>
  );
}
