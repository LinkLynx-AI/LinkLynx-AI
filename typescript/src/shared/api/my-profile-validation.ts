import type { UpdateMyProfileInput } from "./api-client";

type MyProfileValidationError = Error & {
  code: "VALIDATION_ERROR";
  status: 400;
};

export function hasMyProfileUpdateFields(input: UpdateMyProfileInput): boolean {
  return (
    input.displayName !== undefined ||
    input.statusText !== undefined ||
    input.avatarKey !== undefined
  );
}

/**
 * プロフィール更新入力の検証エラーを生成する。
 */
export function createMyProfileValidationError(
  message = "No profile fields provided.",
): MyProfileValidationError {
  const error = new Error(message) as MyProfileValidationError;
  error.name = "GuildChannelApiError";
  error.code = "VALIDATION_ERROR";
  error.status = 400;
  return error;
}
