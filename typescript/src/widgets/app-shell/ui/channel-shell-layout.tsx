type ChannelShellLayoutProps = {
  mainContent: React.ReactNode;
  serverRail?: React.ReactNode;
  channelSidebar?: React.ReactNode;
  header?: React.ReactNode;
  memberList?: React.ReactNode;
};

function FallbackPanel({ title }: { title: string }) {
  return (
    <div className="p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        {title}
      </p>
    </div>
  );
}

/**
 * channels 導線向けの共通App Shell骨格を描画する。
 */
export function ChannelShellLayout({
  mainContent,
  serverRail,
  channelSidebar,
  header,
  memberList,
}: ChannelShellLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--llx-bg-tertiary)] text-[var(--llx-text-primary)] md:grid md:grid-cols-[72px_240px_minmax(0,1fr)_240px]">
      <aside className="hidden border-r border-[var(--llx-divider)] bg-[var(--llx-bg-tertiary)] md:block">
        {serverRail ?? <FallbackPanel title="Server Rail" />}
      </aside>

      <aside className="hidden border-r border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] md:block">
        {channelSidebar ?? <FallbackPanel title="Channel / DM" />}
      </aside>

      <section className="flex min-h-screen min-w-0 flex-col bg-[var(--llx-bg-primary)] md:min-h-0">
        <header className="border-b border-[var(--llx-divider)] px-6 py-4">
          {header ?? (
            <p className="text-sm text-[var(--llx-header-primary)]">
              チャンネルヘッダー（Route契約プレビュー）
            </p>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-6">{mainContent}</div>
      </section>

      <aside className="hidden border-l border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] md:block">
        {memberList ?? <FallbackPanel title="Member List" />}
      </aside>
    </div>
  );
}
