import { PasswordResetCompleteScreen, parsePasswordResetCompleteState } from "@/features/auth-password-reset";

type PasswordResetCompletePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PasswordResetCompletePage({ searchParams }: PasswordResetCompletePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const state = parsePasswordResetCompleteState(resolvedSearchParams);

  return <PasswordResetCompleteScreen state={state} />;
}
