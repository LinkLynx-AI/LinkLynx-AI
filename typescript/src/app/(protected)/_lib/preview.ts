import { parseGuardKind, parsePlaceholderState } from "@/features";
import type { GuardKind, PlaceholderState } from "@/shared/config";

type SearchParamsObject = Record<string, string | string[] | undefined>;

type SearchParamsInput = Promise<SearchParamsObject> | SearchParamsObject | undefined;

export type ProtectedPreviewState = {
  guard: GuardKind | null;
  state: PlaceholderState | null;
};

export async function resolveProtectedPreviewState(
  searchParamsInput: SearchParamsInput,
): Promise<ProtectedPreviewState> {
  const resolvedSearchParams = await Promise.resolve(searchParamsInput ?? {});

  return {
    guard: parseGuardKind(resolvedSearchParams.guard),
    state: parsePlaceholderState(resolvedSearchParams.state),
  };
}
