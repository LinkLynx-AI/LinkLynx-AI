import { z } from "zod";
import { classNames } from "@/shared";

export type AuthSearchParams = Record<string, string | string[] | undefined>;

const verifyEmailStateSchema = z.enum(["waiting", "resent", "resend-error", "expired"]);
const verifyEmailCompleteStateSchema = z.enum(["success", "already-verified"]);

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

export type VerifyEmailState = z.infer<typeof verifyEmailStateSchema>;
export type VerifyEmailCompleteState = z.infer<typeof verifyEmailCompleteStateSchema>;

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

function createVerifyEmailView(state: VerifyEmailState): AuthStatusView {
  const baseView: AuthStatusView = {
    eyebrow: "Email Verification",
    statusLabel: "確認待ち",
    statusTone: "neutral",
    title: "確認メールを送信しました",
    description:
      "登録したメールアドレスに確認リンクを送信しました。メール内のリンクを開いて認証を完了してください。",
    primaryAction: {
      href: "/verify-email?state=resent",
      label: "確認メールを再送する",
    },
    secondaryAction: {
      href: "/login",
      label: "ログインへ戻る",
    },
    footnote: "メールが見つからない場合は迷惑メールフォルダも確認してください。",
  };

  switch (state) {
    case "waiting":
      return baseView;
    case "resent":
      return {
        ...baseView,
        statusLabel: "再送完了",
        statusTone: "success",
        primaryAction: {
          href: "/verify-email?state=resent",
          label: "確認メールをもう一度再送する",
        },
        notice: {
          testId: "verify-email-notice-resent",
          message: "確認メールを再送しました。受信トレイをご確認ください。",
          tone: "success",
        },
      };
    case "resend-error":
      return {
        ...baseView,
        statusLabel: "再送失敗",
        statusTone: "error",
        title: "確認メールを再送できませんでした",
        description: "ネットワーク状況を確認して、時間をおいてもう一度再送してください。",
        notice: {
          testId: "verify-email-notice-resend-error",
          message: "確認メールの再送に失敗しました。再試行してください。",
          tone: "error",
        },
      };
    case "expired":
      return {
        ...baseView,
        statusLabel: "リンク期限切れ",
        statusTone: "warning",
        title: "確認リンクの有効期限が切れています",
        description: "新しい確認メールを再送して、届いた最新リンクから再度アクセスしてください。",
        primaryAction: {
          href: "/verify-email?state=resent",
          label: "新しい確認メールを再送する",
        },
        notice: {
          testId: "verify-email-notice-expired",
          message: "以前の確認リンクは利用できません。新しいリンクを発行してください。",
          tone: "warning",
        },
      };
  }
}

function createVerifyEmailCompleteView(state: VerifyEmailCompleteState): AuthStatusView {
  const baseView: AuthStatusView = {
    eyebrow: "Verification Complete",
    statusLabel: "確認完了",
    statusTone: "success",
    title: "メール確認が完了しました",
    description: "アカウントの有効化が完了しました。ログインして LinkLynx を利用開始できます。",
    primaryAction: {
      href: "/login",
      label: "ログインへ進む",
    },
    secondaryAction: {
      href: "/verify-email",
      label: "確認メール画面に戻る",
    },
    footnote: "ログイン後は通常どおりワークスペースへ参加できます。",
  };

  if (state === "already-verified") {
    return {
      ...baseView,
      statusLabel: "確認済み",
      title: "このメールはすでに確認済みです",
      description: "同じメールアドレスでそのままログインできます。",
      footnote: "ログインに失敗する場合は、パスワード再設定をお試しください。",
    };
  }

  return baseView;
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
 * `/verify-email` の state クエリを解釈する。
 *
 * Contract:
 * - 許可値は `waiting|resent|resend-error|expired`
 * - 未知の値は `waiting` にフォールバックする
 */
export function parseVerifyEmailState(searchParams: AuthSearchParams): VerifyEmailState {
  return verifyEmailStateSchema.catch("waiting").parse(readStateParam(searchParams));
}

/**
 * `/verify-email/complete` の state クエリを解釈する。
 *
 * Contract:
 * - 許可値は `success|already-verified`
 * - 未知の値は `success` にフォールバックする
 */
export function parseVerifyEmailCompleteState(
  searchParams: AuthSearchParams
): VerifyEmailCompleteState {
  return verifyEmailCompleteStateSchema.catch("success").parse(readStateParam(searchParams));
}

/**
 * メール確認待ち・再送関連のUIを描画する。
 *
 * Contract:
 * - stateに応じて waiting/resend/error/expired の表示のみを担当する
 * - メール再送処理や検証処理は実行しない
 */
export function VerifyEmailScreen({ state }: { state: VerifyEmailState }) {
  return <AuthStatusCard view={createVerifyEmailView(state)} />;
}

/**
 * メール確認完了画面のUIを描画する。
 *
 * Contract:
 * - stateに応じて success/already-verified を表示する
 * - 画面内で次アクション導線を提供する
 */
export function VerifyEmailCompleteScreen({ state }: { state: VerifyEmailCompleteState }) {
  return <AuthStatusCard view={createVerifyEmailCompleteView(state)} />;
}
