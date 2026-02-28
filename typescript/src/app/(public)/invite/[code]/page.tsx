import { createUiGateway } from "@/entities";
import type { InvitePageStatus } from "@/entities";
import { cn } from "@/shared/lib";

type InvitePageParams = Promise<{ code: string }> | { code: string };

type InvitePageProps = {
  params: InvitePageParams;
};

function statusBadgeClassName(status: InvitePageStatus): string {
  if (status === "valid") {
    return "bg-emerald-500/20 text-emerald-300";
  }

  if (status === "expired") {
    return "bg-amber-500/20 text-amber-300";
  }

  return "bg-[var(--llx-brand-red)]/20 text-[var(--llx-brand-red)]";
}

function statusLabel(status: InvitePageStatus): string {
  if (status === "valid") {
    return "VALID";
  }

  if (status === "expired") {
    return "EXPIRED";
  }

  return "INVALID";
}

export default async function InvitePage({ params }: InvitePageProps) {
  const uiGateway = createUiGateway();
  const resolvedParams = await Promise.resolve(params);
  const content = await uiGateway.guild.getInvitePageContent(resolvedParams.code);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--llx-bg-tertiary)] px-4 py-10 text-[var(--llx-text-primary)]">
      <section className="w-full max-w-lg rounded-xl border border-[var(--llx-divider)] bg-[var(--llx-bg-primary)] p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
            Invite
          </p>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em]",
              statusBadgeClassName(content.status),
            )}
          >
            {statusLabel(content.status)}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold">{content.title}</h1>
        <p className="mt-2 text-sm text-[var(--llx-text-muted)]">{content.description}</p>

        {content.guildName !== undefined ? (
          <div className="mt-6 rounded-lg border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] p-4">
            <p className="text-sm font-medium text-[var(--llx-text-primary)]">
              {content.guildName}
            </p>
            {content.memberCountLabel !== undefined ? (
              <p className="mt-1 text-xs text-[var(--llx-text-muted)]">
                {content.memberCountLabel}
              </p>
            ) : null}
          </div>
        ) : null}

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

        {content.primaryAction.description !== undefined ? (
          <p className="mt-3 text-xs text-[var(--llx-text-muted)]">
            {content.primaryAction.description}
          </p>
        ) : null}

        {content.recoveryActions.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {content.recoveryActions.map((action) => (
              <a
                key={`${action.href}-${action.label}`}
                href={action.href}
                className="text-xs text-[var(--llx-brand-blurple)] underline-offset-2 transition hover:underline"
              >
                {action.label}
              </a>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
