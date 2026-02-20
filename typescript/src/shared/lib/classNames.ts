type ClassNameValue = string | false | null | undefined;

/**
 * 条件付きクラス名を空白区切りで結合する。
 *
 * Contract:
 * - falsy 値（false/null/undefined）は除外する
 * - 有効な文字列のみを順序を保って結合する
 */
export function classNames(...values: ClassNameValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
