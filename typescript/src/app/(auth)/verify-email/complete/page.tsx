import { VerifyEmailCompleteScreen, parseVerifyEmailCompleteState } from "@/features/auth-verify";

type VerifyEmailCompletePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerifyEmailCompletePage({ searchParams }: VerifyEmailCompletePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const state = parseVerifyEmailCompleteState(resolvedSearchParams);

  return <VerifyEmailCompleteScreen state={state} />;
}
