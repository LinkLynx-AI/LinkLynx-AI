import { PasswordResetTokenScreen, parsePasswordResetTokenState } from "@/features/auth-password-reset";

type PasswordResetTokenPageProps = {
  params?: Promise<{ token?: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PasswordResetTokenPage({
  params,
  searchParams,
}: PasswordResetTokenPageProps) {
  const resolvedParams = (await params) ?? {};
  const resolvedSearchParams = (await searchParams) ?? {};
  const state = parsePasswordResetTokenState(resolvedSearchParams);
  const token = resolvedParams.token ?? "";

  return <PasswordResetTokenScreen state={state} token={token} />;
}
