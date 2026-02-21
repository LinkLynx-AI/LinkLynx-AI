import { RegisterEntryScreen, parseRegisterEntryState } from "@/features/auth-entry";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const state = parseRegisterEntryState(resolvedSearchParams);

  return <RegisterEntryScreen state={state} />;
}
