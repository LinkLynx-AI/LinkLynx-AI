import { ChannelSidebar } from "@/widgets/legacy/ui/channel-sidebar";
import { ServerSync } from "@/widgets/legacy/ui/channel-sidebar/server-sync";
import { MemberListPanel } from "@/widgets/legacy/ui/member-list";
import { RightPanelContainer } from "@/widgets/legacy/ui/panels";

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
