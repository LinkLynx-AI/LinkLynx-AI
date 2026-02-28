import { APP_ROUTES, buildChannelRoute } from "@/shared/config";

export function ChannelShellServerRail() {
  return (
    <div className="space-y-3 p-3">
      <div className="h-12 w-12 rounded-2xl bg-[var(--llx-brand-blurple)]" />
      <div className="h-12 w-12 rounded-full bg-[var(--llx-bg-primary)]" />
      <div className="h-12 w-12 rounded-full bg-[var(--llx-bg-primary)]" />
      <div className="h-12 w-12 rounded-full bg-[var(--llx-bg-primary)]" />
    </div>
  );
}

export function ChannelShellSidebar() {
  return (
    <div className="p-3">
      <p className="px-2 py-2 text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        Channels
      </p>
      <div className="mt-2 space-y-1">
        <a
          href={APP_ROUTES.channels.me}
          className="block rounded px-2 py-2 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
        >
          @me
        </a>
        <a
          href={buildChannelRoute("guild-1", "channel-general")}
          className="block rounded bg-[var(--llx-bg-selected)] px-2 py-2 text-sm text-[var(--llx-text-primary)]"
        >
          # general
        </a>
        <a
          href={buildChannelRoute("guild-1", "channel-random")}
          className="block rounded px-2 py-2 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
        >
          # random
        </a>
        <a
          href={APP_ROUTES.settings.profile}
          className="block rounded px-2 py-2 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
        >
          設定へ
        </a>
      </div>
    </div>
  );
}

export function ChannelShellMemberList() {
  return (
    <div className="space-y-2 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        Members
      </p>
      <div className="rounded bg-[var(--llx-bg-primary)] px-2 py-2 text-sm text-[var(--llx-text-secondary)]">
        Alice
      </div>
      <div className="rounded bg-[var(--llx-bg-primary)] px-2 py-2 text-sm text-[var(--llx-text-secondary)]">
        Bob
      </div>
      <div className="rounded bg-[var(--llx-bg-primary)] px-2 py-2 text-sm text-[var(--llx-text-secondary)]">
        Carol
      </div>
    </div>
  );
}
