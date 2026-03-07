import type { AuthActionError, PrincipalProvisionError } from "@/entities";

export const PASSWORD_RESET_COMPLETION_MESSAGE =
  "メールアドレスが登録されている場合、パスワード再設定メールを送信しました。";
export const PASSWORD_RESET_RETRY_GUIDANCE_MESSAGE =
  "メールが届かない場合は、迷惑メールフォルダを確認し、少し待ってからもう一度送信してください。";

/**
 * ログイン失敗時の表示文言へ変換する。
 */
export function getLoginErrorMessage(error: AuthActionError): string {
  switch (error.code) {
    case "invalid-credentials":
    case "user-not-found":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "too-many-requests":
      return "試行回数が多すぎます。時間をおいて再試行してください。";
    case "network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認して再試行してください。";
    case "operation-not-allowed":
      return "現在このログイン方式は利用できません。";
    default:
      return "ログインに失敗しました。時間をおいて再試行してください。";
  }
}

/**
 * 新規登録失敗時の表示文言へ変換する。
 */
export function getRegisterErrorMessage(error: AuthActionError): string {
  switch (error.code) {
    case "email-already-in-use":
      return "このメールアドレスは既に使用されています。";
    case "weak-password":
      return "パスワード強度が不足しています。6文字以上で再入力してください。";
    case "invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "too-many-requests":
      return "試行回数が多すぎます。時間をおいて再試行してください。";
    case "network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認して再試行してください。";
    case "operation-not-allowed":
      return "現在この登録方式は利用できません。";
    default:
      return "新規登録に失敗しました。時間をおいて再試行してください。";
  }
}

/**
 * Google サインイン失敗時の表示文言へ変換する。
 */
export function getGoogleSignInErrorMessage(error: AuthActionError): string {
  switch (error.code) {
    case "popup-closed-by-user":
      return "Googleサインインをキャンセルしました。";
    case "popup-blocked":
      return "ポップアップがブロックされました。ブラウザ設定を確認して再試行してください。";
    case "cancelled-popup-request":
      return "Googleサインインの処理が中断されました。もう一度お試しください。";
    case "account-exists-with-different-credential":
      return "このメールアドレスは別のログイン方法で登録されています。既存の方法でログインしてください。";
    case "too-many-requests":
      return "試行回数が多すぎます。時間をおいて再試行してください。";
    case "network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認して再試行してください。";
    case "operation-not-allowed":
      return "現在このログイン方式は利用できません。";
    default:
      return "Googleサインインに失敗しました。時間をおいて再試行してください。";
  }
}

/**
 * メール確認関連操作失敗時の表示文言へ変換する。
 */
export function getVerifyEmailErrorMessage(error: AuthActionError): string {
  switch (error.code) {
    case "unauthenticated":
      return "確認メールを再送するにはログインが必要です。";
    case "requires-recent-login":
      return "再認証が必要です。いったんログインし直してください。";
    case "too-many-requests":
      return "再送信が短時間に集中しています。少し待って再試行してください。";
    case "network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認して再試行してください。";
    default:
      return "メール確認処理に失敗しました。時間をおいて再試行してください。";
  }
}

function appendRequestIdSuffix(message: string, requestId: string | null): string {
  if (requestId === null) {
    return message;
  }

  return `${message} (request_id: ${requestId})`;
}

/**
 * principal 自動作成導線の失敗を表示文言へ変換する。
 */
export function getPrincipalProvisionErrorMessage(error: PrincipalProvisionError): string {
  switch (error.code) {
    case "unauthenticated":
    case "token-unavailable":
      return "セッションが無効です。再度ログインしてください。";
    case "email-not-verified":
      return "メール確認が未完了です。確認後に再試行してください。";
    case "principal-not-mapped":
      return appendRequestIdSuffix(
        "アカウント初期化に失敗しました。時間をおいて再試行してください。",
        error.requestId,
      );
    case "auth-unavailable":
      return appendRequestIdSuffix(
        "認証基盤が一時的に利用できません。時間をおいて再試行してください。",
        error.requestId,
      );
    case "network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認して再試行してください。";
    case "unexpected-response":
    case "unknown":
      return appendRequestIdSuffix(
        "アカウント初期化で予期しないエラーが発生しました。時間をおいて再試行してください。",
        error.requestId,
      );
  }
}
