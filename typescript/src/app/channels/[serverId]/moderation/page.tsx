import { ModerationQueuePage } from "@/features";

export default async function ModerationQueueRoute({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = await params;
  return <ModerationQueuePage serverId={serverId} />;
}
