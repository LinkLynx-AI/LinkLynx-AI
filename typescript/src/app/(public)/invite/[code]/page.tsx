import { createUiGateway } from "@/entities";

type InvitePageParams = Promise<{ code: string }> | { code: string };

type InvitePageProps = {
  params: InvitePageParams;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const uiGateway = createUiGateway();
  const resolvedParams = await Promise.resolve(params);
  const content = await uiGateway.guild.getInvitePageContent(resolvedParams.code);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--llx-bg-tertiary)] px-4 py-10 text-[var(--llx-text-primary)]">
      <section className="w-full max-w-md rounded-xl border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
          Invite
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{content.title}</h1>
        <p className="mt-2 text-sm text-[var(--llx-text-muted)]">{content.description}</p>

        <div className="mt-8 grid gap-3">
          <a
            href={content.primaryAction.href}
            className="rounded-md bg-[var(--llx-brand-blurple)] px-4 py-3 text-center text-sm font-medium text-white transition hover:brightness-110"
          >
            {content.primaryAction.label}
          </a>
          <a
            href={content.secondaryAction.href}
            className="rounded-md border border-[var(--llx-divider)] px-4 py-3 text-center text-sm text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            {content.secondaryAction.label}
          </a>
        </div>
      </section>
    </main>
  );
}
