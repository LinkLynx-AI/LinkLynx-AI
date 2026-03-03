import { AuthLayout } from "@/app/(auth)/_components/auth-layout";
import { VerifyEmailPanel } from "@/features/auth-flow/ui/verify-email-panel";

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
  const resolved = await Promise.resolve(searchParams ?? {});
  const initialEmail = toSingleValue(resolved.email);
  const initialSent = toSingleValue(resolved.sent);

  return (
    <AuthLayout
      title="メールを確認してください"
      description="登録したメールアドレスに確認リンクを送りました"
    >
      <VerifyEmailPanel initialEmail={initialEmail} initialSent={initialSent} />
    </AuthLayout>
  );
}
