import type {
  ConversationMessage,
  ConversationMessageAction,
  ConversationMessageState,
} from "@/entities";
import { cn } from "@/shared/lib";

const STATE_LABEL_MAP: Record<ConversationMessageState, string> = {
  sent: "",
  pending: "送信中",
  failed: "失敗",
  edited: "編集済み",
  deleted: "削除済み",
};

const ACTION_LABEL_MAP: Record<ConversationMessageAction, string> = {
  retry: "↻",
  jump: "↗",
  edit: "✎",
  delete: "🗑",
};

function stateClassName(state: ConversationMessageState): string {
  switch (state) {
    case "pending":
      return "bg-[var(--llx-brand-yellow)]/20 text-[var(--llx-brand-yellow)]";
    case "failed":
      return "bg-[var(--llx-brand-red)]/20 text-[var(--llx-brand-red)]";
    case "edited":
      return "bg-[var(--llx-brand-blurple)]/20 text-[var(--llx-brand-blurple)]";
    case "deleted":
      return "bg-[var(--llx-interactive-muted)]/25 text-[var(--llx-text-muted)]";
    default:
      return "hidden";
  }
}

type ConversationMessageRowProps = {
  message: ConversationMessage;
};

/**
 * 会話タイムラインの1メッセージ行を描画する。
 */
export function ConversationMessageRow({ message }: ConversationMessageRowProps) {
  const stateLabel = STATE_LABEL_MAP[message.state];

  return (
    <article
      className={cn(
        "group relative -mx-2 rounded px-2 py-0.5 hover:bg-[#2e3035]",
        message.system && "bg-[#2b2d31]/40",
      )}
    >
      <div className="flex items-start gap-3 py-1.5">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--llx-bg-selected)] text-[11px] font-semibold text-[var(--llx-text-primary)]">
          {message.avatarText}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-medium leading-5 text-[var(--llx-header-primary)]">
              {message.authorName}
            </p>
            <p className="text-xs text-[var(--llx-text-muted)]">{message.timestampLabel}</p>
            {stateLabel.length > 0 ? (
              <span
                className={cn(
                  "rounded px-1.5 py-[1px] text-[10px] font-medium leading-4",
                  stateClassName(message.state),
                )}
              >
                {stateLabel}
              </span>
            ) : null}
          </div>

          <p
            className={cn(
              "mt-0.5 text-[15px] leading-[1.375rem] text-[var(--llx-text-secondary)]",
              message.compact && "text-sm",
              message.state === "deleted" && "italic text-[var(--llx-text-muted)] line-through",
              message.system && "text-[var(--llx-text-muted)]",
            )}
          >
            {message.body}
          </p>
        </div>
      </div>

      {message.actions.length > 0 ? (
        <div className="absolute right-2 top-0 hidden -translate-y-1/2 items-center rounded-md border border-black/40 bg-[var(--llx-bg-secondary)] p-0.5 shadow-md group-hover:flex">
          {message.actions.map((action) => (
            <button
              key={`${message.id}-${action}`}
              type="button"
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded text-[11px] transition",
                action === "delete"
                  ? "text-[var(--llx-brand-red)] hover:bg-[var(--llx-brand-red)]/10"
                  : "text-[var(--llx-text-secondary)] hover:bg-[var(--llx-bg-selected)]",
              )}
              aria-label={action}
              title={action}
            >
              {ACTION_LABEL_MAP[action]}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
