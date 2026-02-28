import { APP_ROUTES } from "@/shared/config";

export function SettingsShellSidebar() {
  return (
    <div className="space-y-1 p-3">
      <p className="px-2 py-2 text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        Settings
      </p>
      <a
        href={APP_ROUTES.settings.profile}
        className="block rounded bg-[var(--llx-bg-selected)] px-2 py-2 text-sm text-[var(--llx-text-primary)]"
      >
        プロフィール
      </a>
      <a
        href={APP_ROUTES.settings.appearance}
        className="block rounded px-2 py-2 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
      >
        外観
      </a>
      <a
        href={APP_ROUTES.channels.me}
        className="block rounded px-2 py-2 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
      >
        チャンネルへ戻る
      </a>
    </div>
  );
}

export function SettingsShellCloseRail() {
  return (
    <div className="flex flex-col items-center gap-2 text-[var(--llx-text-muted)]">
      <a
        href={APP_ROUTES.channels.me}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] text-sm transition hover:bg-[var(--llx-bg-selected)]"
      >
        ✕
      </a>
      <span className="text-xs">ESC</span>
    </div>
  );
}
