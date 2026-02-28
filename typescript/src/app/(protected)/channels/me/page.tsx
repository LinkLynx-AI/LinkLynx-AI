import { ProtectedPreviewGate } from "@/features";
import { createUiGateway } from "@/entities";
import { ChannelShellLayout, ShellStatePlaceholder } from "@/widgets";
import {
  ChannelShellMemberList,
  ChannelShellServerRail,
  ChannelShellSidebar,
} from "@/app/(protected)/_components/channel-shell-preview";
import { resolveProtectedPreviewState } from "@/app/(protected)/_lib/preview";

type SearchParamsObject = Record<string, string | string[] | undefined>;

type ChannelsMePageProps = {
  searchParams?: Promise<SearchParamsObject> | SearchParamsObject;
};

export default async function ChannelsMePage({ searchParams }: ChannelsMePageProps) {
  const uiGateway = createUiGateway();
  const [previewState, shellNavigation, content] = await Promise.all([
    resolveProtectedPreviewState(searchParams),
    uiGateway.guild.getChannelShellNavigation(),
    uiGateway.message.getChannelsMeContent(),
  ]);
  const shellNavigationForMe = {
    ...shellNavigation,
    serverRailItems: shellNavigation.serverRailItems.map((item) => ({
      ...item,
      selected: item.id === "home",
    })),
    channelItems: shellNavigation.channelItems.map((item) => ({
      ...item,
      selected: item.id === "me",
    })),
  };

  const mainContent =
    previewState.state === null ? (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--llx-text-primary)]">{content.title}</h1>
        <p className="text-sm text-[var(--llx-text-muted)]">{content.description}</p>
        <div className="flex flex-wrap gap-3">
          {content.quickActions.map((action) => (
            <a
              key={`${action.href}-${action.label}`}
              href={action.href}
              className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
            >
              {action.label}
            </a>
          ))}
        </div>
      </section>
    ) : (
      <ShellStatePlaceholder state={previewState.state} />
    );

  return (
    <ProtectedPreviewGate guard={previewState.guard}>
      <ChannelShellLayout
        serverRail={<ChannelShellServerRail items={shellNavigationForMe.serverRailItems} />}
        channelSidebar={
          <ChannelShellSidebar
            sectionLabel={shellNavigationForMe.sectionLabel}
            items={shellNavigationForMe.channelItems}
          />
        }
        memberList={<ChannelShellMemberList items={shellNavigationForMe.memberItems} />}
        mainContent={mainContent}
      />
    </ProtectedPreviewGate>
  );
}
