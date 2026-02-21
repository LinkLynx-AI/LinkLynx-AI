import { LoginEntryScreen, parseLoginEntryState } from "@/features/auth-entry";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const state = parseLoginEntryState(resolvedSearchParams);

  return <LoginEntryScreen state={state} />;
}
