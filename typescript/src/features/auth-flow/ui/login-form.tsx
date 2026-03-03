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
      <label className="block space-y-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--llx-header-secondary)]">
          Email
        </span>
        <input
          type="email"
          value={form.email}
          onChange={(event) => updateForm("email", event.target.value)}
          autoComplete="email"
          className="w-full rounded-md border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] px-3 py-2 text-sm text-[var(--llx-text-primary)] outline-none transition focus:border-[var(--llx-brand-blurple)]"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--llx-header-secondary)]">
          Password
        </span>
        <input
          type="password"
          value={form.password}
          onChange={(event) => updateForm("password", event.target.value)}
          autoComplete="current-password"
          className="w-full rounded-md border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] px-3 py-2 text-sm text-[var(--llx-text-primary)] outline-none transition focus:border-[var(--llx-brand-blurple)]"
        />
      </label>

      {errorMessage === null ? null : (
        <p className="rounded-md border border-[var(--llx-brand-red)]/40 bg-[var(--llx-brand-red)]/10 px-3 py-2 text-sm text-[var(--llx-brand-red)]">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-[var(--llx-brand-blurple)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
