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
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--llx-text-primary)]">
          <span className="mr-1 text-[var(--llx-channels-default)]">{content.headerIcon}</span>
          {content.title}
        </p>
        <p className="mt-1 truncate text-xs text-[var(--llx-text-muted)]">{content.subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        {content.headerActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--llx-divider)] text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
            aria-label={action.label}
            title={action.label}
          >
            {action.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 会話タイムラインとcomposer UIを描画する。
 */
export function ConversationTimelineComposer({ content }: ConversationTimelineComposerProps) {
  return (
    <section className="flex min-h-full flex-col gap-4">
      <div className="grid gap-2 rounded-md border border-[var(--llx-divider)] bg-black/10 p-2 sm:grid-cols-2 lg:grid-cols-3">
        {content.quickActions.map((action) => (
          <a
            key={`${action.href}-${action.label}`}
            href={action.href}
            className="rounded border border-[var(--llx-divider)] px-2 py-1 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            {action.label}
          </a>
        ))}
      </div>

      <div className="flex-1 space-y-1 overflow-auto rounded-md border border-[var(--llx-divider)] bg-black/5 p-2">
        {content.messages.map((message) => (
          <ConversationMessageRow key={message.id} message={message} />
        ))}
      </div>

      <div className="space-y-2 rounded-md border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] p-3">
        <p className="text-xs text-[var(--llx-text-muted)]">{content.composer.placeholder}</p>
        <div
          className={cn(
            "min-h-16 rounded-md border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] px-3 py-2 text-sm text-[var(--llx-text-secondary)]",
            content.composer.state === "typing" && "ring-1 ring-[var(--llx-brand-blurple)]",
          )}
        >
          {content.composer.draftText ?? ""}
        </div>
        <p className="text-xs text-[var(--llx-text-muted)]">{content.composer.hint}</p>
      </div>
    </section>
  );
}
