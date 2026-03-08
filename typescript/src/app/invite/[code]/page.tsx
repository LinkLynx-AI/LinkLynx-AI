import { createUiGateway } from "@/entities";
import { parseInviteAutoJoinFlag } from "@/shared/config";
import { InvitePageClient } from "./invite-page-client";

type InvitePageProps = {
  params: Promise<{ code: string }> | { code: string };
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    Promise.resolve(params),
    Promise.resolve(searchParams ?? {}),
  ]);
  const uiGateway = createUiGateway({ provider: "api" });
  const content = await uiGateway.guild.getInvitePageContent(resolvedParams.code);
  const autoJoin = parseInviteAutoJoinFlag(resolvedSearchParams.autoJoin);

  return <InvitePageClient content={content} autoJoin={autoJoin} />;
}
