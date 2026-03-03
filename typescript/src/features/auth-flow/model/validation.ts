import { z } from "zod";

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type PasswordResetInput = {
  email: string;
};

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  message: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const EMAIL_SCHEMA = z
  .string()
  .trim()
  .min(1, "メールアドレスを入力してください。")
  .email("メールアドレスの形式が正しくありません。");

const LOGIN_INPUT_SCHEMA = z.object({
  email: EMAIL_SCHEMA,
  password: z.string().min(1, "パスワードを入力してください。"),
});

const REGISTER_INPUT_SCHEMA = z
  .object({
    email: EMAIL_SCHEMA,
    password: z.string().min(6, "パスワードは6文字以上で入力してください。"),
    confirmPassword: z.string().min(1, "確認用パスワードを入力してください。"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "確認用パスワードが一致しません。",
  });

const PASSWORD_RESET_INPUT_SCHEMA = z.object({
  email: EMAIL_SCHEMA,
});

function toValidationFailure(error: z.ZodError): ValidationFailure {
  const firstIssue = error.issues[0];
  return {
    ok: false,
    message: firstIssue?.message ?? "入力内容を確認してください。",
  };
}

/**
 * ログインフォーム入力を検証する。
 */
export function validateLoginInput(input: LoginInput): ValidationResult<LoginInput> {
  const parsed = LOGIN_INPUT_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return toValidationFailure(parsed.error);
  }

  return {
    ok: true,
    data: parsed.data,
  };
}

/**
 * 新規登録フォーム入力を検証する。
 */
export function validateRegisterInput(input: RegisterInput): ValidationResult<RegisterInput> {
  const parsed = REGISTER_INPUT_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return toValidationFailure(parsed.error);
  }

  return {
    ok: true,
    data: parsed.data,
  };
}

/**
 * パスワード再設定フォーム入力を検証する。
 */
export function validatePasswordResetInput(
  input: PasswordResetInput,
): ValidationResult<PasswordResetInput> {
  const parsed = PASSWORD_RESET_INPUT_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return toValidationFailure(parsed.error);
  }

  return {
    ok: true,
    data: parsed.data,
  };
}
