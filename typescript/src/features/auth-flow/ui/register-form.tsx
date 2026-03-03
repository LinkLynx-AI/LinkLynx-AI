"use client";

import { useState } from "react";
import { registerWithEmailAndPassword, sendVerificationEmailForCurrentUser } from "@/entities";
import { APP_ROUTES } from "@/shared/config";
import { buildVerifyEmailRoute, getRegisterErrorMessage, validateRegisterInput } from "../model";

type RegisterFormState = {
  email: string;
  password: string;
  confirmPassword: string;
};

const INITIAL_FORM_STATE: RegisterFormState = {
  email: "",
  password: "",
  confirmPassword: "",
};

/**
 * 新規登録フォームを表示し Firebase へ接続する。
 */
export function RegisterForm() {
  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateForm<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
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
    const validation = validateRegisterInput(form);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setIsSubmitting(true);
    const registerResult = await registerWithEmailAndPassword({
      email: validation.data.email,
      password: validation.data.password,
    });

    if (!registerResult.ok) {
      setIsSubmitting(false);
      setErrorMessage(getRegisterErrorMessage(registerResult.error));
      return;
    }

    if (registerResult.data.emailVerified) {
      setIsSubmitting(false);
      window.location.assign(APP_ROUTES.channels.me);
      return;
    }

    const verifyEmailResult = await sendVerificationEmailForCurrentUser();
    setIsSubmitting(false);

    if (!verifyEmailResult.ok) {
      console.warn("Verification mail sending failed after register.", verifyEmailResult.error);
    }

    window.location.assign(
      buildVerifyEmailRoute({
        email: registerResult.data.email ?? validation.data.email,
        sent: verifyEmailResult.ok,
      }),
    );
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
          autoComplete="new-password"
          className="w-full rounded bg-discord-input-bg px-3 py-2.5 text-sm text-discord-text-normal outline-none ring-0 transition focus:ring-2 focus:ring-discord-brand-blurple"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-discord-header-secondary">
          パスワード（確認） <span className="text-discord-brand-red">*</span>
        </label>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(event) => updateForm("confirmPassword", event.target.value)}
          autoComplete="new-password"
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
        {isSubmitting ? "登録中..." : "アカウントを作成"}
      </button>
    </form>
  );
}
