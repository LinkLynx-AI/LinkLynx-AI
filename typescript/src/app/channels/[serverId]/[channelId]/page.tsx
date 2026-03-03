import { ChannelView } from "@/components/chat/channel-view";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ serverId: string; channelId: string }>;
}) {
  const { channelId } = await params;

  return <ChannelView channelId={channelId} />;
}
