import { AuthRoutePreview } from "@/app/(auth)/_components/auth-route-preview";
import { createUiGateway } from "@/entities";
import { LoginForm } from "@/features";
import { normalizeReturnToPath, parseLoginRedirectReason } from "@/shared/config";

type SearchParamsObject = Record<string, string | string[] | undefined>;

type LoginPageProps = {
  searchParams?: Promise<SearchParamsObject> | SearchParamsObject;
};

function toSingleValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const uiGateway = createUiGateway();
  const [content, resolvedSearchParams] = await Promise.all([
    uiGateway.auth.getRouteContent("login"),
    Promise.resolve(searchParams ?? {}),
  ]);
  const returnTo = normalizeReturnToPath(toSingleValue(resolvedSearchParams.returnTo));
  const reason = parseLoginRedirectReason(resolvedSearchParams.reason);

  return (
    <AuthRoutePreview {...content}>
      <LoginForm returnTo={returnTo} reason={reason} />
    </AuthRoutePreview>
  );
}
