import type { InvitePageContent } from "@/entities";
import type { ReactNode } from "react";

const STATUS_LABELS: Record<InvitePageContent["status"], string> = {
  valid: "有効",
  invalid: "無効",
  expired: "期限切れ",
  unavailable: "確認不能",
};

const STATUS_TONES: Record<InvitePageContent["status"], string> = {
  valid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  invalid: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  expired: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  unavailable: "border-sky-400/30 bg-sky-400/10 text-sky-100",
};

function formatUsage(content: InvitePageContent): string | null {
  if (content.uses === null) {
    return null;
  }

  if (content.maxUses === null) {
    return `${content.uses} 回使用済み`;
  }

  return `${content.uses} / ${content.maxUses} 回使用済み`;
}

type InviteRouteNotice = {
  tone: "info" | "error";
  text: string;
};

type InviteRoutePreviewProps = InvitePageContent & {
  notice?: InviteRouteNotice | null;
  primaryActionElement?: ReactNode;
  secondaryActionElement?: ReactNode;
};

function resolveNoticeClassName(tone: InviteRouteNotice["tone"]): string {
  if (tone === "error") {
    return "bg-discord-brand-red/10 text-discord-brand-red";
  }

  return "bg-discord-bg-secondary text-discord-text-muted";
}

/**
 * 公開招待ページの検証結果を表示する。
 */
export function InviteRoutePreview({
  notice = null,
  primaryActionElement,
  secondaryActionElement,
  ...content
}: InviteRoutePreviewProps) {
  const usageText = formatUsage(content);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-discord-bg-tertiary px-4 py-10 text-discord-text-normal">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_45%)]" />
      </div>

      <section className="relative w-full max-w-[560px] rounded-[12px] border border-discord-divider bg-discord-bg-primary p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-discord-header-secondary">
            Public Invite
          </p>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_TONES[content.status]}`}
          >
            {STATUS_LABELS[content.status]}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-discord-header-primary">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-discord-text-muted">{content.description}</p>

        <div className="mt-6 space-y-3 rounded-[10px] border border-discord-divider bg-discord-bg-secondary p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-discord-header-secondary">
              招待コード
            </p>
            <p className="mt-1 font-mono text-sm text-discord-text-normal">{content.inviteCode}</p>
          </div>

          {content.guildName === null ? null : (
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-discord-header-secondary">
                サーバー
              </p>
              <p className="mt-1 text-sm text-discord-text-normal">{content.guildName}</p>
            </div>
          )}

          {content.expiresAt === null ? null : (
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-discord-header-secondary">
                有効期限
              </p>
              <p className="mt-1 text-sm text-discord-text-normal">{content.expiresAt}</p>
            </div>
          )}

          {usageText === null ? null : (
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-discord-header-secondary">
                利用状況
              </p>
              <p className="mt-1 text-sm text-discord-text-normal">{usageText}</p>
            </div>
          )}
        </div>

        {notice === null ? null : (
          <p
            className={`mt-6 rounded-[8px] px-3 py-2 text-sm ${resolveNoticeClassName(notice.tone)}`}
          >
            {notice.text}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {primaryActionElement ?? (
            <a
              href={content.primaryAction.href}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-[8px] bg-discord-brand-blurple px-4 text-sm font-semibold text-white transition hover:bg-discord-btn-blurple-hover"
            >
              {content.primaryAction.label}
            </a>
          )}
          {secondaryActionElement ?? (
            <a
              href={content.secondaryAction.href}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-[8px] border border-discord-divider px-4 text-sm font-semibold text-discord-text-normal transition hover:bg-discord-bg-secondary"
            >
              {content.secondaryAction.label}
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
