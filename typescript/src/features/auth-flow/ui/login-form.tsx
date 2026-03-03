"use client";

import { useState } from "react";
import { loginWithEmailAndPassword } from "@/entities";
import { APP_ROUTES } from "@/shared/config";
import { buildVerifyEmailRoute, getLoginErrorMessage, validateLoginInput } from "../model";

type LoginFormState = {
  email: string;
  password: string;
};

const INITIAL_FORM_STATE: LoginFormState = {
  email: "",
  password: "",
};

/**
 * ログインフォームを表示し Firebase 認証へ接続する。
 */
export function LoginForm() {
  const [form, setForm] = useState<LoginFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateForm<K extends keyof LoginFormState>(key: K, value: LoginFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    const validation = validateLoginInput(form);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setIsSubmitting(true);
    const result = await loginWithEmailAndPassword(validation.data);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(getLoginErrorMessage(result.error));
      return;
    }

    if (!result.data.emailVerified) {
      window.location.assign(
        buildVerifyEmailRoute({
          email: result.data.email,
        }),
      );
      return;
    }

    window.location.assign(APP_ROUTES.channels.me);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-discord-header-secondary">
          メールアドレス <span className="text-discord-brand-red">*</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(event) => updateForm("email", event.target.value)}
          autoComplete="email"
          className="w-full rounded bg-discord-input-bg px-3 py-2.5 text-sm text-discord-text-normal outline-none ring-0 transition focus:ring-2 focus:ring-discord-brand-blurple"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-discord-header-secondary">
          パスワード <span className="text-discord-brand-red">*</span>
        </label>
        <input
          type="password"
          value={form.password}
          onChange={(event) => updateForm("password", event.target.value)}
          autoComplete="current-password"
          className="w-full rounded bg-discord-input-bg px-3 py-2.5 text-sm text-discord-text-normal outline-none ring-0 transition focus:ring-2 focus:ring-discord-brand-blurple"
        />
      </div>

      {errorMessage !== null && (
        <p className="rounded bg-discord-brand-red/10 px-3 py-2 text-sm text-discord-brand-red">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded bg-discord-brand-blurple px-4 py-3 text-sm font-medium text-white transition hover:bg-discord-btn-blurple-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
