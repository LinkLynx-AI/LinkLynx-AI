import { redirect } from "next/navigation";
import { buildSettingsRoute } from "@/shared/config";

function getSearchParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;

  redirect(
    buildSettingsRoute("profile", {
      returnTo: getSearchParamValue(resolvedSearchParams.returnTo),
    }),
  );
}
