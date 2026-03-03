import { LoginForm } from "@/features";
import { APP_ROUTES, normalizeReturnToPath, parseLoginRedirectReason } from "@/shared/config";
import Link from "next/link";

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
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const returnTo = normalizeReturnToPath(toSingleValue(resolvedSearchParams.returnTo));
  const reason = parseLoginRedirectReason(resolvedSearchParams.reason);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-discord-bg-tertiary px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-5%,rgba(88,101,242,0.18),transparent)]" />
      </div>

      <section className="relative w-full max-w-[480px] rounded-[4px] bg-discord-bg-primary px-8 py-10 shadow-[0_2px_10px_rgba(0,0,0,0.6),0_8px_40px_rgba(0,0,0,0.4)]">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-discord-header-primary">おかえり！</h1>
          <p className="mt-1 text-base text-discord-text-muted">また会えてうれしいです！</p>
        </div>

        <LoginForm returnTo={returnTo} reason={reason} />

        <p className="mt-6 text-sm text-discord-text-muted">
          アカウントをお持ちでないですか？{" "}
          <Link
            href={APP_ROUTES.register}
            className="text-discord-text-link hover:underline"
          >
            新規登録
          </Link>
        </p>
      </section>
    </main>
  );
}
