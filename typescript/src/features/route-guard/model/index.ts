import type { GuardKind, PlaceholderState } from "@/shared/config";

type SearchParamValue = string | string[] | undefined;

function toSingleValue(value: SearchParamValue): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

function isGuardKind(value: string): value is GuardKind {
  return (
    value === "unauthenticated" ||
    value === "forbidden" ||
    value === "not-found" ||
    value === "service-unavailable"
  );
}

function isPlaceholderState(value: string): value is PlaceholderState {
  return (
    value === "loading" ||
    value === "empty" ||
    value === "error" ||
    value === "readonly" ||
    value === "disabled"
  );
}

/**
 * guard クエリ値を GuardKind に変換する。
 */
export function parseGuardKind(value: SearchParamValue): GuardKind | null {
  const normalizedValue = toSingleValue(value);

  if (normalizedValue === null || !isGuardKind(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

/**
 * state クエリ値を PlaceholderState に変換する。
 */
export function parsePlaceholderState(value: SearchParamValue): PlaceholderState | null {
  const normalizedValue = toSingleValue(value);

  if (normalizedValue === null || !isPlaceholderState(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}
