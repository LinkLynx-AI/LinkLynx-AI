import type { ConversationPreviewContent } from "@/entities";
import { cn } from "@/shared/lib";
import { ConversationMessageRow } from "./message-row";

type ConversationHeaderBarProps = {
  content: ConversationPreviewContent;
};

type ConversationTimelineComposerProps = {
  content: ConversationPreviewContent;
};

/**
 * 会話導線のヘッダーUIを描画する。
 */
export function ConversationHeaderBar({ content }: ConversationHeaderBarProps) {
  return (
    <div className="flex h-full items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-[var(--llx-header-primary)]">
          <span className="mr-1 text-[var(--llx-channels-default)]">{content.headerIcon}</span>
          {content.title}
        </p>
      </div>

      <div className="flex items-center gap-2 text-[var(--llx-channels-default)]">
        {content.headerActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-[13px] transition hover:bg-black/20 hover:text-[var(--llx-header-primary)]"
            aria-label={action.label}
            title={action.label}
          >
            {action.icon}
          </button>
        ))}

        <label className="ml-1 hidden h-6 items-center rounded bg-[#1e1f22] px-2 text-xs text-[var(--llx-text-muted)] md:flex">
          <span className="mr-1">AI_discordを検索</span>
          <span>⌕</span>
        </label>
      </div>
    </div>
  );
}

/**
 * 会話タイムラインとcomposer UIを描画する。
 */
export function ConversationTimelineComposer({ content }: ConversationTimelineComposerProps) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-black/20 px-4 py-1">
        <div className="flex flex-wrap gap-1">
          {content.quickActions.map((action) => (
            <a
              key={`${action.href}-${action.label}`}
              href={action.href}
              className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] text-[var(--llx-text-muted)] hover:bg-black/30"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-0.5 px-4 py-4">
          <div className="pb-4">
            <p className="text-[30px] font-extrabold text-[var(--llx-header-primary)]">
              {content.title}
            </p>
            <p className="mt-1 text-sm text-[var(--llx-text-muted)]">{content.subtitle}</p>
          </div>

          {content.messages.map((message) => (
            <ConversationMessageRow key={message.id} message={message} />
          ))}
        </div>
      </div>

      <div className="px-4 pb-6 pt-3">
        <div
          className={cn(
            "rounded-lg bg-[#383a40] px-4 py-3",
            content.composer.state === "typing" && "ring-1 ring-[var(--llx-brand-blurple)]/80",
          )}
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#4e5058] text-sm text-[var(--llx-header-primary)]"
              aria-label="Attach"
            >
              +
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-[var(--llx-text-muted)]">
                {content.composer.placeholder}
              </p>
              {content.composer.draftText !== undefined ? (
                <p className="mt-1 text-sm text-[var(--llx-text-secondary)]">
                  {content.composer.draftText}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-[var(--llx-channels-default)]">
              <button type="button" className="text-sm" aria-label="Gift">
                🎁
              </button>
              <button type="button" className="text-sm" aria-label="Sticker">
                ◷
              </button>
              <button type="button" className="text-sm" aria-label="Emoji">
                ☺
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2 px-1 text-[10px] text-[var(--llx-text-muted)]">
          {content.composer.hint}
        </p>
      </div>
    </section>
  );
}
