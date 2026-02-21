"use client";

import { classNames } from "@/shared";

export const messageDeliveryStates = ["pending", "sent", "failed"] as const;

export type MessageDeliveryState = (typeof messageDeliveryStates)[number];

type MessageDeliveryStatusProps = {
  state: MessageDeliveryState;
  onRetry?: () => void;
};

type MessageDeliveryMeta = {
  label: string;
  toneClassName: string;
};

const messageDeliveryMetaMap: Record<MessageDeliveryState, MessageDeliveryMeta> = {
  pending: {
    label: "送信中",
    toneClassName: "border-discord-yellow/50 bg-discord-yellow/10 text-discord-yellow",
  },
  sent: {
    label: "送信済み",
    toneClassName: "border-discord-green/50 bg-discord-green/10 text-discord-green",
  },
  failed: {
    label: "送信失敗",
    toneClassName: "border-discord-red/50 bg-discord-red/10 text-discord-red",
  },
};

/**
 * 送信状態に応じたラベルとトーン情報を返す。
 *
 * Contract:
 * - `state` は `pending` / `sent` / `failed`
 * - 戻り値はUI表示専用メタ情報
 */
export function getMessageDeliveryMeta(state: MessageDeliveryState): MessageDeliveryMeta {
  return messageDeliveryMetaMap[state];
}

/**
 * 再送導線を表示するかを判定する。
 *
 * Contract:
 * - 仕様上 `failed` のときだけ `true` を返す
 */
export function shouldShowRetryAction(state: MessageDeliveryState): boolean {
  return state === "failed";
}

/**
 * メッセージ送信状態を示すラベルと再送導線を描画する。
 *
 * Contract:
 * - `failed` のときのみ再送ボタンを表示する
 * - `onRetry` 未指定時の再送ボタンは無効化する
 */
export function MessageDeliveryStatus({ state, onRetry }: MessageDeliveryStatusProps) {
  const meta = getMessageDeliveryMeta(state);
  const showRetryAction = shouldShowRetryAction(state);

  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span
        className={classNames(
          "rounded-full border px-2 py-1 font-semibold",
          meta.toneClassName
        )}
      >
        {meta.label}
      </span>
      {showRetryAction ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={!onRetry}
          className={classNames(
            "rounded-md border border-discord-red/60 px-2 py-1 font-semibold text-discord-red transition",
            "hover:bg-discord-red/10 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          再送
        </button>
      ) : null}
    </div>
  );
}
