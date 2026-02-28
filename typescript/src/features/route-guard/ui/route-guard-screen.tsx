import type { GuardKind } from "@/shared/config";
import { APP_ROUTES } from "@/shared/config";

type RouteGuardScreenProps = {
  kind: GuardKind;
};

type GuardContent = {
  title: string;
  description: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction: {
    label: string;
    href: string;
  };
};

const GUARD_CONTENT_MAP: Record<GuardKind, GuardContent> = {
  unauthenticated: {
    title: "ログインが必要です",
    description: "この画面は保護ルートです。ログイン後にもう一度アクセスしてください。",
    primaryAction: {
      label: "ログインへ",
      href: APP_ROUTES.login,
    },
    secondaryAction: {
      label: "新規登録へ",
      href: APP_ROUTES.register,
    },
  },
  forbidden: {
    title: "アクセス権限がありません",
    description: "閲覧または操作に必要な権限が不足しています。管理者へ問い合わせてください。",
    primaryAction: {
      label: "チャンネル一覧へ",
      href: APP_ROUTES.channels.me,
    },
    secondaryAction: {
      label: "ホームへ",
      href: APP_ROUTES.home,
    },
  },
  "not-found": {
    title: "対象が見つかりません",
    description: "指定されたリソースが存在しないか、すでに削除されています。",
    primaryAction: {
      label: "@me へ",
      href: APP_ROUTES.channels.me,
    },
    secondaryAction: {
      label: "ホームへ",
      href: APP_ROUTES.home,
    },
  },
};

/**
 * 保護ルートの遷移ガード画面を描画する。
 */
export function RouteGuardScreen({ kind }: RouteGuardScreenProps) {
  const content = GUARD_CONTENT_MAP[kind];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--llx-bg-tertiary)] p-6 text-[var(--llx-text-primary)]">
      <section className="w-full max-w-xl rounded-xl border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
          Route Guard
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">{content.title}</h1>
        <p className="mt-3 text-sm text-[var(--llx-text-muted)]">{content.description}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={content.primaryAction.href}
            aria-label={`${content.primaryAction.label}: ${content.description}`}
            className="inline-flex items-center justify-center rounded-md bg-[var(--llx-brand-blurple)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
          >
            {content.primaryAction.label}
          </a>
          <a
            href={content.secondaryAction.href}
            aria-label={`${content.secondaryAction.label}: ${content.description}`}
            className="inline-flex items-center justify-center rounded-md border border-[var(--llx-divider)] px-4 py-2 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            {content.secondaryAction.label}
          </a>
        </div>
      </section>
    </main>
  );
}
