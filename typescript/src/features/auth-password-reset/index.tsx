import { z } from "zod";
import { classNames } from "@/shared";

export type AuthSearchParams = Record<string, string | string[] | undefined>;

const passwordResetRequestStateSchema = z.enum(["default", "sent", "error"]);
const passwordResetTokenStateSchema = z.enum([
  "default",
  "invalid",
  "expired",
  "mismatch",
  "submitting",
]);
const passwordResetCompleteStateSchema = z.enum(["success"]);

type StatusTone = "neutral" | "success" | "error" | "warning";
type NoticeTone = "success" | "error" | "warning";

type ActionLinkView = {
  href: string;
  label: string;
};

type StatusNoticeView = {
  testId: string;
  message: string;
  tone: NoticeTone;
};

type AuthStatusView = {
  eyebrow: string;
  statusLabel: string;
  statusTone: StatusTone;
  title: string;
  description: string;
  primaryAction: ActionLinkView;
  secondaryAction: ActionLinkView;
  footnote: string;
  notice?: StatusNoticeView;
};

export type PasswordResetRequestState = z.infer<typeof passwordResetRequestStateSchema>;
export type PasswordResetTokenState = z.infer<typeof passwordResetTokenStateSchema>;
export type PasswordResetCompleteState = z.infer<typeof passwordResetCompleteStateSchema>;

function readStateParam(searchParams: AuthSearchParams): string | undefined {
  const { state } = searchParams;
  if (Array.isArray(state)) {
    return state[0];
  }
  return state;
}

function resolveStatusToneClassName(tone: StatusTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-300/35 bg-emerald-400/10 text-emerald-100";
    case "error":
      return "border-discord-red/60 bg-discord-red/10 text-discord-red";
    case "warning":
      return "border-amber-300/40 bg-amber-400/10 text-amber-100";
    case "neutral":
      return "border-white/20 bg-white/10 text-white/85";
  }
}

function resolveNoticeToneClassName(tone: NoticeTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-300/40 bg-emerald-400/10 text-emerald-100";
    case "error":
      return "border-discord-red/70 bg-discord-red/10 text-discord-red";
    case "warning":
      return "border-amber-300/40 bg-amber-400/10 text-amber-100";
  }
}

function createPasswordResetRequestView(state: PasswordResetRequestState): AuthStatusView {
  const baseView: AuthStatusView = {
    eyebrow: "Password Reset",
    statusLabel: "再設定申請",
    statusTone: "neutral",
    title: "パスワード再設定メールを送信します",
    description:
      "登録済みメールアドレスへ再設定リンクを送信します。メール内のリンクから新しいパスワードを設定してください。",
    primaryAction: {
      href: "/password-reset?state=sent",
      label: "送信状態を表示する",
    },
    secondaryAction: {
      href: "/login",
      label: "ログインへ戻る",
    },
    footnote: "メールが見つからない場合は迷惑メールフォルダも確認してください。",
  };

  switch (state) {
    case "default":
      return baseView;
    case "sent":
      return {
        ...baseView,
        statusLabel: "送信完了",
        statusTone: "success",
        title: "再設定メールを送信しました",
        primaryAction: {
          href: "/password-reset?state=sent",
          label: "再送した状態を表示する",
        },
        notice: {
          testId: "password-reset-request-notice-sent",
          message: "再設定メールを送信しました。受信トレイをご確認ください。",
          tone: "success",
        },
      };
    case "error":
      return {
        ...baseView,
        statusLabel: "送信失敗",
        statusTone: "error",
        title: "再設定メールを送信できませんでした",
        description: "ネットワーク状況を確認して、時間をおいて再度お試しください。",
        primaryAction: {
          href: "/password-reset",
          label: "申請画面で再試行する",
        },
        notice: {
          testId: "password-reset-request-notice-error",
          message: "再設定メールの送信に失敗しました。再試行してください。",
          tone: "error",
        },
      };
  }
}

function createPasswordResetTokenView(state: PasswordResetTokenState, token: string): AuthStatusView {
  const encodedToken = encodeURIComponent(token);
  const baseView: AuthStatusView = {
    eyebrow: "Reset Password",
    statusLabel: "新しいパスワード設定",
    statusTone: "neutral",
    title: "新しいパスワードを設定してください",
    description: "再設定リンクを確認しました。新しいパスワードを入力して更新を完了してください。",
    primaryAction: {
      href: `/password-reset/${encodedToken}?state=submitting`,
      label: "更新中状態を表示する",
    },
    secondaryAction: {
      href: "/login",
      label: "ログインへ戻る",
    },
    footnote: "設定後は新しいパスワードでログインできます。",
  };

  switch (state) {
    case "default":
      return baseView;
    case "submitting":
      return {
        ...baseView,
        statusLabel: "更新中",
        title: "パスワードを更新しています",
        description: "更新完了までこのままお待ちください。",
      };
    case "mismatch":
      return {
        ...baseView,
        statusLabel: "入力不一致",
        statusTone: "error",
        title: "入力したパスワードが一致しません",
        description: "新しいパスワードと確認用パスワードを同じ内容で入力してください。",
        primaryAction: {
          href: `/password-reset/${encodedToken}`,
          label: "入力画面に戻る",
        },
        notice: {
          testId: "password-reset-token-notice-mismatch",
          message: "パスワードが一致しません。入力内容を確認してください。",
          tone: "error",
        },
      };
    case "invalid":
      return {
        ...baseView,
        statusLabel: "リンク無効",
        statusTone: "error",
        title: "この再設定リンクは無効です",
        description: "リンクが壊れているか、すでに利用済みの可能性があります。再申請してください。",
        primaryAction: {
          href: "/password-reset",
          label: "再設定を再申請する",
        },
        notice: {
          testId: "password-reset-token-notice-invalid",
          message: "無効なリンクです。再申請して新しいリンクを発行してください。",
          tone: "error",
        },
      };
    case "expired":
      return {
        ...baseView,
        statusLabel: "リンク期限切れ",
        statusTone: "warning",
        title: "再設定リンクの有効期限が切れています",
        description: "新しい再設定メールを申請して、最新リンクから再度アクセスしてください。",
        primaryAction: {
          href: "/password-reset",
          label: "再設定を再申請する",
        },
        notice: {
          testId: "password-reset-token-notice-expired",
          message: "リンクの期限が切れました。新しいリンクを発行してください。",
          tone: "warning",
        },
      };
  }
}

function createPasswordResetCompleteView(): AuthStatusView {
  return {
    eyebrow: "Password Updated",
    statusLabel: "更新完了",
    statusTone: "success",
    title: "パスワードの更新が完了しました",
    description: "新しいパスワードが設定されました。ログインして利用を再開できます。",
    primaryAction: {
      href: "/login",
      label: "ログインへ進む",
    },
    secondaryAction: {
      href: "/password-reset",
      label: "再設定申請画面に戻る",
    },
    footnote: "身に覚えのない変更がある場合は、すぐに再設定を実施してください。",
  };
}

function AuthStatusCard({ view }: { view: AuthStatusView }) {
  return (
    <section className="w-full rounded-2xl border border-white/10 bg-discord-darker/95 p-6 shadow-2xl sm:p-8">
      <header className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">{view.eyebrow}</p>
        <p
          className={classNames(
            "mx-auto inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
            resolveStatusToneClassName(view.statusTone)
          )}
        >
          {view.statusLabel}
        </p>
        <h1 className="text-2xl font-bold text-white">{view.title}</h1>
        <p className="text-sm text-white/70">{view.description}</p>
      </header>

      {view.notice ? (
        <p
          data-testid={view.notice.testId}
          role="alert"
          className={classNames(
            "mt-5 rounded-md border px-3 py-2 text-sm",
            resolveNoticeToneClassName(view.notice.tone)
          )}
        >
          {view.notice.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={view.primaryAction.href}
          className="inline-flex items-center justify-center rounded-md bg-discord-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
        >
          {view.primaryAction.label}
        </a>
        <a
          href={view.secondaryAction.href}
          className="inline-flex items-center justify-center rounded-md border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          {view.secondaryAction.label}
        </a>
      </div>

      <p className="mt-4 text-xs text-white/60">{view.footnote}</p>
    </section>
  );
}

/**
 * `/password-reset` の state クエリを解釈する。
 *
 * Contract:
 * - 許可値は `default|sent|error`
 * - 未知の値は `default` にフォールバックする
 */
export function parsePasswordResetRequestState(
  searchParams: AuthSearchParams
): PasswordResetRequestState {
  return passwordResetRequestStateSchema.catch("default").parse(readStateParam(searchParams));
}

/**
 * `/password-reset/[token]` の state クエリを解釈する。
 *
 * Contract:
 * - 許可値は `default|invalid|expired|mismatch|submitting`
 * - 未知の値は `default` にフォールバックする
 */
export function parsePasswordResetTokenState(searchParams: AuthSearchParams): PasswordResetTokenState {
  return passwordResetTokenStateSchema.catch("default").parse(readStateParam(searchParams));
}

/**
 * `/password-reset/complete` の state クエリを解釈する。
 *
 * Contract:
 * - 許可値は `success`
 * - 未知の値は `success` にフォールバックする
 */
export function parsePasswordResetCompleteState(
  searchParams: AuthSearchParams
): PasswordResetCompleteState {
  return passwordResetCompleteStateSchema.catch("success").parse(readStateParam(searchParams));
}

/**
 * パスワード再設定申請画面のUIを描画する。
 *
 * Contract:
 * - stateに応じて default/sent/error の表示を担当する
 * - メール送信処理は実行しない
 */
export function PasswordResetRequestScreen({ state }: { state: PasswordResetRequestState }) {
  return <AuthStatusCard view={createPasswordResetRequestView(state)} />;
}

/**
 * パスワード再設定入力画面のUIを描画する。
 *
 * Contract:
 * - stateに応じて invalid/expired/mismatch/submitting を表示する
 * - パスワード更新処理は実行しない
 */
export function PasswordResetTokenScreen({
  state,
  token,
}: {
  state: PasswordResetTokenState;
  token: string;
}) {
  return <AuthStatusCard view={createPasswordResetTokenView(state, token)} />;
}

/**
 * パスワード再設定完了画面のUIを描画する。
 *
 * Contract:
 * - 完了状態の表示と次アクション導線を提供する
 * - 認証判定や更新処理は実行しない
 */
export function PasswordResetCompleteScreen({ state }: { state: PasswordResetCompleteState }) {
  if (state !== "success") {
    return null;
  }
  return <AuthStatusCard view={createPasswordResetCompleteView()} />;
}
