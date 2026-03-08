import { createUiGateway } from "@/entities";
import { InviteRoutePreview } from "@/features";

type InvitePageProps = {
  params: Promise<{ code: string }> | { code: string };
};

export default async function InvitePage({ params }: InvitePageProps) {
  const resolvedParams = await Promise.resolve(params);
  const uiGateway = createUiGateway({ provider: "api" });
  const content = await uiGateway.guild.getInvitePageContent(resolvedParams.code);

  return <InviteRoutePreview {...content} />;
}
