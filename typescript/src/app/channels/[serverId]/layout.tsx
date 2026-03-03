import { ChannelSidebar } from "@/components/channel-sidebar";
import { ServerSync } from "@/components/channel-sidebar/server-sync";
import { MemberListPanel } from "@/components/member-list";
import { RightPanelContainer } from "@/components/panels";

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
      <main className="flex flex-1 flex-col min-w-0 bg-discord-bg-primary">
        {children}
      </main>
      <RightPanelContainer />
      <MemberListPanel />
    </>
  );
}
