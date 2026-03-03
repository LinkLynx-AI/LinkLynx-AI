import type { AuthActionError } from "@/entities";

export const PASSWORD_RESET_COMPLETION_MESSAGE =
  "メールアドレスが登録されている場合、パスワード再設定メールを送信しました。";

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
