import { APP_ROUTES, buildChannelRoute, buildInviteRoute } from "@/shared/config";

const PREVIEW_ROUTES = [
  { label: "Login", href: APP_ROUTES.login },
  { label: "Register", href: APP_ROUTES.register },
  { label: "Verify Email", href: APP_ROUTES.verifyEmail },
  { label: "Password Reset", href: APP_ROUTES.passwordReset },
  { label: "Invite", href: buildInviteRoute("discord-room") },
  { label: "Channels (me)", href: APP_ROUTES.channels.me },
  { label: "Channels (Guild)", href: buildChannelRoute("guild-1", "channel-general") },
  { label: "Settings Profile", href: APP_ROUTES.settings.profile },
  { label: "Settings Appearance", href: APP_ROUTES.settings.appearance },
] as const;

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--llx-bg-tertiary)] px-4 py-10 text-[var(--llx-text-primary)]">
      <section className="w-full max-w-2xl rounded-xl border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
          Route Contract
        </p>
        <h1 className="mt-3 text-3xl font-semibold">LinkLynx UI Skeleton</h1>
        <p className="mt-2 text-sm text-[var(--llx-text-muted)]">
          public/auth/protected の route group を前提に、公開URL契約と遷移導線を固定しています。
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {PREVIEW_ROUTES.map((route) => (
            <a
              key={route.href}
              href={route.href}
              className="rounded-md border border-[var(--llx-divider)] px-4 py-3 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
            >
              <p>{route.label}</p>
              <p className="mt-1 text-xs text-[var(--llx-text-muted)]">{route.href}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
