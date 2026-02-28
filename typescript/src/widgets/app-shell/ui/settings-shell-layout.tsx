type SettingsShellLayoutProps = {
  content: React.ReactNode;
  sidebar?: React.ReactNode;
  closeRail?: React.ReactNode;
};

function SidebarFallback() {
  return (
    <div className="p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        Settings Navigation
      </p>
    </div>
  );
}

/**
 * settings 導線向けの共通App Shell骨格を描画する。
 */
export function SettingsShellLayout({ content, sidebar, closeRail }: SettingsShellLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--llx-bg-primary)] text-[var(--llx-text-primary)] md:grid md:grid-cols-[minmax(0,1fr)_218px_660px_72px_minmax(0,1fr)]">
      <div className="hidden bg-[var(--llx-bg-secondary)] md:block" />

      <aside className="hidden border-r border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] md:block">
        {sidebar ?? <SidebarFallback />}
      </aside>

      <main className="w-full p-6 md:p-10">
        <div className="mx-auto w-full max-w-[660px]">{content}</div>
      </main>

      <aside className="hidden items-start justify-center border-l border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] pt-10 md:flex">
        {closeRail ?? (
          <div className="flex flex-col items-center gap-2 text-[var(--llx-text-muted)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] text-sm">
              ✕
            </span>
            <span className="text-xs">ESC</span>
          </div>
        )}
      </aside>

      <div className="hidden bg-[var(--llx-bg-primary)] md:block" />
    </div>
  );
}
