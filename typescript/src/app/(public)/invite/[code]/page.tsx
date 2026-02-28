import { APP_ROUTES } from "@/shared/config";

type InvitePageParams = Promise<{ code: string }> | { code: string };

type InvitePageProps = {
  params: InvitePageParams;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const resolvedParams = await Promise.resolve(params);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--llx-bg-tertiary)] px-4 py-10 text-[var(--llx-text-primary)]">
      <section className="w-full max-w-md rounded-xl border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
          Invite
        </p>
        <h1 className="mt-3 text-2xl font-semibold">招待コードを確認</h1>
        <p className="mt-2 text-sm text-[var(--llx-text-muted)]">
          招待コード{" "}
          <span className="font-medium text-[var(--llx-text-primary)]">{resolvedParams.code}</span>
          の表示プレビューです。
        </p>

        <div className="mt-8 grid gap-3">
          <a
            href={APP_ROUTES.login}
            className="rounded-md bg-[var(--llx-brand-blurple)] px-4 py-3 text-center text-sm font-medium text-white transition hover:brightness-110"
          >
            ログインして参加
          </a>
          <a
            href={APP_ROUTES.home}
            className="rounded-md border border-[var(--llx-divider)] px-4 py-3 text-center text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            ホームへ戻る
          </a>
        </div>
      </section>
    </main>
  );
}
