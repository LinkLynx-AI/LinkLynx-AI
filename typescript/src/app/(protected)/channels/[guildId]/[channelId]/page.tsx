import { ProtectedPreviewGate } from "@/features";
import { createUiGateway } from "@/entities";
import { buildChannelRoute } from "@/shared/config";
import {
  ChannelMemberList,
  ChannelServerRail,
  ChannelShellLayout,
  ChannelSidebar,
  ConversationHeaderBar,
  ConversationTimelineComposer,
  ShellStatePlaceholder,
} from "@/widgets";
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
      <ConversationTimelineComposer content={content} />
    ) : (
      <ShellStatePlaceholder state={previewState.state} />
    );

  return (
    <ProtectedPreviewGate guard={previewState.guard}>
      <ChannelShellLayout
        serverRail={<ChannelServerRail items={shellNavigationForChannel.serverRailItems} />}
        channelSidebar={
          <ChannelSidebar
            sectionLabel={shellNavigationForChannel.sectionLabel}
            items={shellNavigationForChannel.channelItems}
          />
        }
        memberList={<ChannelMemberList items={shellNavigationForChannel.memberItems} />}
        header={<ConversationHeaderBar content={content} />}
        mainContent={mainContent}
      />
    </ProtectedPreviewGate>
  );
}
