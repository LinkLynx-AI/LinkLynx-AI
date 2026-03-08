import { APP_ROUTES, normalizeInviteResumeCode, normalizeReturnToPath } from "@/shared/config";

/**
 * verify-email 画面の遷移URLを構築する。
 */
export function buildVerifyEmailRoute(params: {
  email: string | null;
  sent?: boolean;
  returnTo?: string | null;
  inviteCode?: string | null;
}): string {
  const query = new URLSearchParams();
  const normalizedEmail = params.email?.trim() ?? "";
  const normalizedReturnToPath = normalizeReturnToPath(params.returnTo);
  const normalizedInviteCode = normalizeInviteResumeCode(params.inviteCode);

  if (normalizedEmail.length > 0) {
    query.set("email", normalizedEmail);
  }

  if (params.sent !== undefined) {
    query.set("sent", params.sent ? "1" : "0");
  }

  if (normalizedReturnToPath !== null) {
    query.set("returnTo", normalizedReturnToPath);
  }

  if (normalizedInviteCode !== null) {
    query.set("invite", normalizedInviteCode);
  }

  const queryString = query.toString();
  if (queryString.length === 0) {
    return APP_ROUTES.verifyEmail;
  }

  return `${APP_ROUTES.verifyEmail}?${queryString}`;
}

export {
  getGoogleSignInErrorMessage,
  getLoginErrorMessage,
  getPrincipalProvisionErrorMessage,
  getRegisterErrorMessage,
  getVerifyEmailErrorMessage,
  PASSWORD_RESET_COMPLETION_MESSAGE,
  PASSWORD_RESET_RETRY_GUIDANCE_MESSAGE,
} from "./error-message";
export {
  validateLoginInput,
  validatePasswordResetInput,
  validateRegisterInput,
} from "./validation";
