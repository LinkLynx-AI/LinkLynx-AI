import { PasswordResetRequestScreen, parsePasswordResetRequestState } from "@/features/auth-password-reset";

type PasswordResetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PasswordResetPage({ searchParams }: PasswordResetPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const state = parsePasswordResetRequestState(resolvedSearchParams);

  return <PasswordResetRequestScreen state={state} />;
}
