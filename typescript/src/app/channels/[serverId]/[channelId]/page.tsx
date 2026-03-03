import { ChannelView } from "@/widgets/chat";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ serverId: string; channelId: string }>;
}) {
  const { channelId } = await params;

  return <ChannelView channelId={channelId} />;
}
