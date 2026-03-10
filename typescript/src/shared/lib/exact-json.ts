const STRICT_DECIMAL_PATTERN = /^(0|[1-9]\d*)$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isStrictDecimalString(value: string): boolean {
  return STRICT_DECIMAL_PATTERN.test(value);
}

/**
 * 指定フィールドの decimal integer を文字列として保持しながら JSON を parse する。
 */
export function parseJsonWithExactDecimalFields(
  rawText: string,
  fieldNames: readonly string[],
): unknown {
  const fieldPattern = fieldNames.map(escapeRegExp).join("|");
  const normalizedText = rawText.replace(
    new RegExp(`"(${fieldPattern})"\\s*:\\s*(-?\\d+)`, "g"),
    (_, fieldName: string, value: string) => `"${fieldName}":"${value}"`,
  );

  return JSON.parse(normalizedText);
}
