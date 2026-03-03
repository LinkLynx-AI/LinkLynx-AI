/**
 * 認証状態の初期化中に表示する待機画面を描画する。
 */
export function AuthInitializingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--llx-bg-tertiary)] p-6 text-[var(--llx-text-primary)]">
      <section className="w-full max-w-xl rounded-xl border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
          Auth Session
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">認証状態を確認中です</h1>
        <p className="mt-3 text-sm text-[var(--llx-text-muted)]">
          セッションの復元が完了するまで、このままお待ちください。
        </p>
      </section>
    </main>
  );
}
