import { ModerationReportDetailPage } from "@/features";

export default async function ModerationReportDetailRoute({
  params,
}: {
  params: Promise<{ serverId: string; reportId: string }>;
}) {
  const { serverId, reportId } = await params;
  return <ModerationReportDetailPage serverId={serverId} reportId={reportId} />;
}
