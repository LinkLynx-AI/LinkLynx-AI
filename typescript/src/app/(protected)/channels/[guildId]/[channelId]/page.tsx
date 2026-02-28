import { ProtectedPreviewGate } from "@/features";
import { createUiGateway } from "@/entities";
import { buildChannelRoute } from "@/shared/config";
import { ChannelShellLayout, ShellStatePlaceholder } from "@/widgets";
import {
  ChannelShellMemberList,
  ChannelShellServerRail,
  ChannelShellSidebar,
} from "@/app/(protected)/_components/channel-shell-preview";
import { resolveProtectedPreviewState } from "@/app/(protected)/_lib/preview";

type SearchParamsObject = Record<string, string | string[] | undefined>;

type ChannelRouteParams =
  | Promise<{ guildId: string; channelId: string }>
  | { guildId: string; channelId: string };

type ChannelPageProps = {
  params: ChannelRouteParams;
  searchParams?: Promise<SearchParamsObject> | SearchParamsObject;
};

export default async function ChannelPage({ params, searchParams }: ChannelPageProps) {
  const uiGateway = createUiGateway();
  const previewState = await resolveProtectedPreviewState(searchParams);
  const resolvedParams = await Promise.resolve(params);
  const [shellNavigation, content] = await Promise.all([
    uiGateway.guild.getChannelShellNavigation(),
    uiGateway.message.getChannelContent({
      guildId: resolvedParams.guildId,
      channelId: resolvedParams.channelId,
    }),
  ]);
  const activeChannelRoute = buildChannelRoute(resolvedParams.guildId, resolvedParams.channelId);
  const activeServerId = resolvedParams.guildId.startsWith("guild-")
    ? `srv-${resolvedParams.guildId.slice("guild-".length)}`
    : "srv-1";
  const shellNavigationForChannel = {
    ...shellNavigation,
    serverRailItems: shellNavigation.serverRailItems.map((item) => ({
      ...item,
      selected: item.id === activeServerId,
    })),
    channelItems: shellNavigation.channelItems.map((item) => ({
      ...item,
      selected: item.href === activeChannelRoute,
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
        serverRail={<ChannelShellServerRail items={shellNavigationForChannel.serverRailItems} />}
        channelSidebar={
          <ChannelShellSidebar
            sectionLabel={shellNavigationForChannel.sectionLabel}
            items={shellNavigationForChannel.channelItems}
          />
        }
        memberList={<ChannelShellMemberList items={shellNavigationForChannel.memberItems} />}
        mainContent={mainContent}
      />
    </ProtectedPreviewGate>
  );
}
