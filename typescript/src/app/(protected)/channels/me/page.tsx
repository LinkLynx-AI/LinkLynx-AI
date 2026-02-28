import { ProtectedPreviewGate } from "@/features";
import { createUiGateway } from "@/entities";
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
      selected: item.id === "friends",
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
        serverRail={<ChannelServerRail items={shellNavigationForMe.serverRailItems} />}
        channelSidebar={
          <ChannelSidebar
            sectionLabel={shellNavigationForMe.sectionLabel}
            items={shellNavigationForMe.channelItems}
          />
        }
        memberList={<ChannelMemberList items={shellNavigationForMe.memberItems} />}
        header={<ConversationHeaderBar content={content} />}
        mainContent={mainContent}
      />
    </ProtectedPreviewGate>
  );
}
