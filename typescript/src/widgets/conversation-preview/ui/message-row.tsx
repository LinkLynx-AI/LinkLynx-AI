import type {
  ConversationMessage,
  ConversationMessageAction,
  ConversationMessageState,
} from "@/entities";
import { cn } from "@/shared/lib";

const STATE_LABEL_MAP: Record<ConversationMessageState, string> = {
  sent: "送信済み",
  pending: "送信中",
  failed: "失敗",
  edited: "編集済み",
  deleted: "削除済み",
};

const ACTION_LABEL_MAP: Record<ConversationMessageAction, string> = {
  retry: "再送",
  jump: "ジャンプ",
  edit: "編集",
  delete: "削除",
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
      return "bg-[var(--llx-interactive-muted)]/20 text-[var(--llx-text-muted)]";
    default:
      return "bg-transparent text-[var(--llx-text-muted)]";
  }
}

type ConversationMessageRowProps = {
  message: ConversationMessage;
};

/**
 * 会話タイムラインの1メッセージ行を描画する。
 */
export function ConversationMessageRow({ message }: ConversationMessageRowProps) {
  return (
    <article
      className={cn(
        "group rounded-md px-3 py-2 transition hover:bg-black/10",
        message.system && "border border-dashed border-[var(--llx-divider)] bg-black/10",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--llx-bg-selected)] text-[11px] font-semibold text-[var(--llx-text-primary)]">
          {message.avatarText}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--llx-text-primary)]">
              {message.authorName}
            </p>
            <p className="text-xs text-[var(--llx-text-muted)]">{message.timestampLabel}</p>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                stateClassName(message.state),
              )}
            >
              {STATE_LABEL_MAP[message.state]}
            </span>
          </div>

          <p
            className={cn(
              "mt-1 text-sm leading-relaxed text-[var(--llx-text-secondary)]",
              message.compact && "text-xs",
              message.state === "deleted" && "italic text-[var(--llx-text-muted)] line-through",
            )}
          >
            {message.body}
          </p>

          <div className="mt-2 hidden flex-wrap gap-2 group-hover:flex">
            {message.actions.map((action) => (
              <button
                key={`${message.id}-${action}`}
                type="button"
                className={cn(
                  "rounded border border-[var(--llx-divider)] px-2 py-1 text-[11px] transition",
                  action === "delete"
                    ? "text-[var(--llx-brand-red)] hover:bg-[var(--llx-brand-red)]/10"
                    : "text-[var(--llx-text-secondary)] hover:bg-[var(--llx-bg-selected)]",
                )}
              >
                {ACTION_LABEL_MAP[action]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
