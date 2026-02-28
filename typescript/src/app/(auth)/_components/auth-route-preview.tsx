import { APP_ROUTES } from "@/shared/config";

type AuthRoutePreviewProps = {
  title: string;
  description: string;
  links: Array<{
    label: string;
    href: string;
  }>;
};

export function AuthRoutePreview({ title, description, links }: AuthRoutePreviewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--llx-bg-tertiary)] px-4 py-10 text-[var(--llx-text-primary)]">
      <section className="w-full max-w-md rounded-xl border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
          Auth Route
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--llx-text-muted)]">{description}</p>

        <div className="mt-8 space-y-3">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-md border border-[var(--llx-divider)] px-4 py-3 text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
            >
              <span>{link.label}</span>
              <span className="text-xs text-[var(--llx-text-muted)]">{link.href}</span>
            </a>
          ))}
        </div>

        <a
          href={APP_ROUTES.home}
          className="mt-6 inline-flex text-sm text-[var(--llx-brand-blurple)] transition hover:opacity-90"
        >
          ホームへ戻る
        </a>
      </section>
    </main>
  );
}
