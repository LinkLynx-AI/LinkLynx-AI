import { VerifyEmailScreen, parseVerifyEmailState } from "@/features/auth-verify";

type VerifyEmailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const state = parseVerifyEmailState(resolvedSearchParams);

  return <VerifyEmailScreen state={state} />;
}
