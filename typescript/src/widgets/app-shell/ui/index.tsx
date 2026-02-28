type AppShellPlaceholderProps = {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
};

/**
 * UI基盤のApp Shellプレースホルダを描画する。
 */
export function AppShellPlaceholder({ title, subtitle, children }: AppShellPlaceholderProps) {
  return (
    <section className="w-full max-w-3xl rounded-2xl border border-white/10 bg-discord-dark p-8 shadow-xl">
      <header>
        <h1 className="text-3xl font-bold text-discord-primary">{title}</h1>
        <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
      </header>
      <div className="mt-6 flex items-center gap-3">{children}</div>
    </section>
  );
}
