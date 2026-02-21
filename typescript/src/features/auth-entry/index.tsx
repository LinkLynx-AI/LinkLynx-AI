import { z } from "zod";
import { classNames } from "@/shared";

type AuthFieldType = "text" | "email" | "password";

type AuthFieldView = {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  type: AuthFieldType;
  error?: string;
};

type AuthEntryView = {
  eyebrow: string;
  title: string;
  description: string;
  globalError?: string;
  fields: AuthFieldView[];
  submitLabel: string;
  isDisabled: boolean;
  isLoading: boolean;
  assistiveLink?: {
    href: string;
    label: string;
  };
  switchLink: {
    prompt: string;
    href: string;
    label: string;
  };
  caption?: string;
};

export type AuthSearchParams = Record<string, string | string[] | undefined>;

const loginStateSchema = z.enum(["default", "field-error", "form-error", "disabled", "loading"]);
const registerStateSchema = z.enum([
  "default",
  "field-error",
  "form-error",
  "disabled",
  "loading",
]);

type LoginFieldName = "email" | "password";
type RegisterFieldName = "displayName" | "email" | "password" | "confirmPassword";

export type LoginEntryState = z.infer<typeof loginStateSchema>;
export type RegisterEntryState = z.infer<typeof registerStateSchema>;

function readStateParam(searchParams: AuthSearchParams): string | undefined {
  const { state } = searchParams;
  if (Array.isArray(state)) {
    return state[0];
  }
  return state;
}

function setFieldError(
  fields: AuthFieldView[],
  fieldName: LoginFieldName | RegisterFieldName,
  message: string
): void {
  const field = fields.find((candidate) => candidate.name === fieldName);
  if (field) {
    field.error = message;
  }
}

function createLoginFields(): AuthFieldView[] {
  return [
    {
      id: "login-email",
      name: "email",
      label: "メールアドレス",
      placeholder: "you@example.com",
      autoComplete: "email",
      type: "email",
    },
    {
      id: "login-password",
      name: "password",
      label: "パスワード",
      placeholder: "8文字以上のパスワード",
      autoComplete: "current-password",
      type: "password",
    },
  ];
}

function createRegisterFields(): AuthFieldView[] {
  return [
    {
      id: "register-display-name",
      name: "displayName",
      label: "表示名",
      placeholder: "LinkLynx User",
      autoComplete: "nickname",
      type: "text",
    },
    {
      id: "register-email",
      name: "email",
      label: "メールアドレス",
      placeholder: "you@example.com",
      autoComplete: "email",
      type: "email",
    },
    {
      id: "register-password",
      name: "password",
      label: "パスワード",
      placeholder: "8文字以上のパスワード",
      autoComplete: "new-password",
      type: "password",
    },
    {
      id: "register-confirm-password",
      name: "confirmPassword",
      label: "パスワード（確認）",
      placeholder: "確認用に再入力してください",
      autoComplete: "new-password",
      type: "password",
    },
  ];
}

/**
 * URLクエリからログイン画面用の表示stateを解釈する。
 *
 * Contract:
 * - 未知の値は `default` にフォールバックする
 * - 返却値は `default|field-error|form-error|disabled|loading`
 */
export function parseLoginEntryState(searchParams: AuthSearchParams): LoginEntryState {
  return loginStateSchema.catch("default").parse(readStateParam(searchParams));
}

/**
 * URLクエリから登録画面用の表示stateを解釈する。
 *
 * Contract:
 * - 未知の値は `default` にフォールバックする
 * - 返却値は `default|field-error|form-error|disabled|loading`
 */
export function parseRegisterEntryState(searchParams: AuthSearchParams): RegisterEntryState {
  return registerStateSchema.catch("default").parse(readStateParam(searchParams));
}

function createLoginEntryView(state: LoginEntryState): AuthEntryView {
  const fields = createLoginFields();
  const isDisabled = state === "disabled" || state === "loading";
  const isLoading = state === "loading";
  const view: AuthEntryView = {
    eyebrow: "Welcome Back",
    title: "おかえりなさい",
    description: "メールアドレスとパスワードを入力して LinkLynx にログインしてください。",
    fields,
    submitLabel: isLoading ? "ログイン中..." : "ログイン",
    isDisabled,
    isLoading,
    assistiveLink: {
      href: "/password-reset",
      label: "パスワードをお忘れですか？",
    },
    switchLink: {
      prompt: "アカウントをお持ちでないですか？",
      href: "/register",
      label: "新規登録",
    },
  };

  if (state === "form-error") {
    view.globalError = "メールアドレスまたはパスワードが正しくありません。";
  }
  if (state === "field-error") {
    setFieldError(fields, "password", "パスワードを入力してください。");
  }

  return view;
}

function createRegisterEntryView(state: RegisterEntryState): AuthEntryView {
  const fields = createRegisterFields();
  const isDisabled = state === "disabled" || state === "loading";
  const isLoading = state === "loading";
  const view: AuthEntryView = {
    eyebrow: "Create Account",
    title: "LinkLynxへようこそ",
    description: "新規アカウントを作成して、チームの会話に参加しましょう。",
    fields,
    submitLabel: isLoading ? "作成中..." : "アカウントを作成",
    isDisabled,
    isLoading,
    caption: "登録することで利用規約とプライバシーポリシーに同意したものとみなされます。",
    switchLink: {
      prompt: "すでにアカウントをお持ちですか？",
      href: "/login",
      label: "ログイン",
    },
  };

  if (state === "form-error") {
    view.globalError =
      "現在、新規登録は一時停止しています。しばらく時間をおいて再度お試しください。";
  }
  if (state === "field-error") {
    setFieldError(fields, "confirmPassword", "確認用パスワードが一致しません。");
  }

  return view;
}

function AuthEntryForm({ view }: { view: AuthEntryView }) {
  const isDisabled = view.isDisabled || view.isLoading;

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-discord-darker/95 p-6 shadow-2xl sm:p-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
          {view.eyebrow}
        </p>
        <h1 className="text-2xl font-bold text-white">{view.title}</h1>
        <p className="text-sm text-white/70">{view.description}</p>
      </header>

      <form className="mt-6 space-y-4" noValidate>
        {view.globalError ? (
          <p
            data-testid="auth-global-error"
            role="alert"
            className="rounded-md border border-discord-red/70 bg-discord-red/10 px-3 py-2 text-sm text-discord-red"
          >
            {view.globalError}
          </p>
        ) : null}

        {view.fields.map((field) => {
          const errorId = `${field.id}-error`;

          return (
            <div key={field.id} className="space-y-2">
              <label
                htmlFor={field.id}
                className="block text-xs font-semibold uppercase tracking-wide text-white/70"
              >
                {field.label}
              </label>
              <input
                id={field.id}
                name={field.name}
                type={field.type}
                disabled={isDisabled}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                aria-invalid={Boolean(field.error)}
                aria-describedby={field.error ? errorId : undefined}
                className={classNames(
                  "w-full rounded-md border px-3 py-2.5 text-sm text-white outline-none transition",
                  "bg-discord-dark border-white/10 placeholder:text-white/45 focus:border-discord-primary focus:ring-2 focus:ring-discord-primary/40",
                  isDisabled ? "cursor-not-allowed opacity-70" : undefined,
                  field.error ? "border-discord-red/70 focus:border-discord-red" : undefined
                )}
              />
              {field.error ? (
                <p
                  id={errorId}
                  data-testid={`auth-field-error-${field.name}`}
                  role="alert"
                  className="text-xs text-discord-red"
                >
                  {field.error}
                </p>
              ) : null}
            </div>
          );
        })}

        {view.assistiveLink ? (
          <div className="text-right">
            <a
              href={view.assistiveLink.href}
              className="text-sm font-semibold text-discord-primary transition hover:underline"
            >
              {view.assistiveLink.label}
            </a>
          </div>
        ) : null}

        {view.caption ? <p className="text-xs text-white/60">{view.caption}</p> : null}

        <button
          type="button"
          disabled={isDisabled}
          aria-busy={view.isLoading}
          className={classNames(
            "w-full rounded-md bg-discord-primary px-4 py-2.5 text-sm font-semibold text-white transition",
            isDisabled ? "cursor-not-allowed opacity-70" : "hover:bg-[#4752c4]"
          )}
        >
          {view.submitLabel}
        </button>
      </form>

      <footer className="mt-5 text-center text-sm text-white/70">
        {view.switchLink.prompt}{" "}
        <a
          href={view.switchLink.href}
          className="font-semibold text-discord-primary transition hover:underline"
        >
          {view.switchLink.label}
        </a>
      </footer>
    </section>
  );
}

/**
 * ログイン画面の状態に応じた表示データを組み立てて描画する。
 *
 * Contract:
 * - `state` は URL クエリ由来のUI状態
 * - 認証処理は行わず、表示のみを担当する
 */
export function LoginEntryScreen({ state }: { state: LoginEntryState }) {
  return <AuthEntryForm view={createLoginEntryView(state)} />;
}

/**
 * 登録画面の状態に応じた表示データを組み立てて描画する。
 *
 * Contract:
 * - `state` は URL クエリ由来のUI状態
 * - 認証処理は行わず、表示のみを担当する
 */
export function RegisterEntryScreen({ state }: { state: RegisterEntryState }) {
  return <AuthEntryForm view={createRegisterEntryView(state)} />;
}
