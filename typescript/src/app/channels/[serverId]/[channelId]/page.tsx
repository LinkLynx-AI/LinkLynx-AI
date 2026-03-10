import { ChannelView } from "@/widgets/chat";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ serverId: string; channelId: string }>;
}) {
  const { serverId, channelId } = await params;

  return <ChannelView guildId={serverId} channelId={channelId} />;
}
