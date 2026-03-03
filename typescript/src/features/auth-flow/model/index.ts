import { APP_ROUTES } from "@/shared/config";

/**
 * verify-email 画面の遷移URLを構築する。
 */
export function buildVerifyEmailRoute(params: { email: string | null; sent?: boolean }): string {
  const query = new URLSearchParams();
  const normalizedEmail = params.email?.trim() ?? "";

  if (normalizedEmail.length > 0) {
    query.set("email", normalizedEmail);
  }

  if (params.sent !== undefined) {
    query.set("sent", params.sent ? "1" : "0");
  }

  const queryString = query.toString();
  if (queryString.length === 0) {
    return APP_ROUTES.verifyEmail;
  }

  return `${APP_ROUTES.verifyEmail}?${queryString}`;
}

export {
  getLoginErrorMessage,
  getRegisterErrorMessage,
  getVerifyEmailErrorMessage,
  PASSWORD_RESET_COMPLETION_MESSAGE,
} from "./error-message";
export {
  validateLoginInput,
  validatePasswordResetInput,
  validateRegisterInput,
} from "./validation";
