export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-discord-darkest text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.32),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 py-8 sm:px-8 lg:flex-row lg:items-stretch lg:gap-12">
        <section className="w-full rounded-2xl border border-white/10 bg-discord-dark/90 p-6 shadow-xl lg:max-w-md lg:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">LinkLynx</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight">
            会話の流れを止めない、Discordライクなチームチャット。
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            ログインまたは登録して、通知・メンション・ルーム参加までの導線を一気に開始できます。
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/75">
            <li className="rounded-md border border-white/10 bg-black/15 px-3 py-2">
              サーバー参加導線を1画面で把握
            </li>
            <li className="rounded-md border border-white/10 bg-black/15 px-3 py-2">
              認証エラーはフォーム内で即時に確認
            </li>
            <li className="rounded-md border border-white/10 bg-black/15 px-3 py-2">
              主要CTAを中央配置して操作迷子を防止
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/register"
              className="rounded-md bg-discord-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
            >
              アカウント作成
            </a>
            <a
              href="/login"
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              ログイン
            </a>
          </div>
        </section>

        <main className="w-full max-w-xl">{children}</main>
      </div>
    </div>
  );
}
