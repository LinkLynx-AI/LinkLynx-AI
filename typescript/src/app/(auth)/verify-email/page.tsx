import { createUiGateway } from "@/entities";
import { normalizeInviteResumeCode, normalizeReturnToPath } from "@/shared/config";
import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";
import { VerifyEmailPanel } from "@/features";

type SearchParamsObject = Record<string, string | string[] | undefined>;

type VerifyEmailPageProps = {
  searchParams?: Promise<SearchParamsObject> | SearchParamsObject;
};

function toSingleValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const uiGateway = createUiGateway();
  const [content, resolvedSearchParams] = await Promise.all([
    uiGateway.auth.getRouteContent("verify-email"),
    Promise.resolve(searchParams ?? {}),
  ]);
  const initialEmail = toSingleValue(resolvedSearchParams.email);
  const initialSent = toSingleValue(resolvedSearchParams.sent);
  const inviteCode = normalizeInviteResumeCode(toSingleValue(resolvedSearchParams.invite));
  const returnTo = normalizeReturnToPath(toSingleValue(resolvedSearchParams.returnTo));

  return (
    <AuthRoutePreview {...content}>
      <VerifyEmailPanel
        initialEmail={initialEmail}
        initialSent={initialSent}
        inviteCode={inviteCode}
        returnTo={returnTo}
      />
    </AuthRoutePreview>
  );
}
