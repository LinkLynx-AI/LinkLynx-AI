import { ChannelSidebar } from "@/widgets/channel-sidebar";
import { ServerSync } from "@/widgets/channel-sidebar";
import { MemberListPanel } from "@/widgets/member-list";
import { RightPanelContainer } from "@/widgets/panels";

export default async function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;

  return (
    <>
      <ServerSync serverId={serverId} />
      <ChannelSidebar />
      <main className="flex flex-1 flex-col min-w-0 bg-discord-bg-primary">{children}</main>
      <RightPanelContainer />
      <MemberListPanel />
    </>
  );
}
