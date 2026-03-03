"use client";

import { useState } from "react";
import {
  ensurePrincipalProvisionedForCurrentUser,
  registerWithEmailAndPassword,
  sendVerificationEmailForCurrentUser,
} from "@/entities";
import { APP_ROUTES } from "@/shared/config";
import {
  buildVerifyEmailRoute,
  getPrincipalProvisionErrorMessage,
  getRegisterErrorMessage,
  validateRegisterInput,
} from "../model";

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
      const provisionResult = await ensurePrincipalProvisionedForCurrentUser();
      setIsSubmitting(false);

      if (!provisionResult.ok) {
        console.warn("Principal provisioning failed after register.", provisionResult.error);
        setErrorMessage(getPrincipalProvisionErrorMessage(provisionResult.error));
        return;
      }

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
          autoComplete="new-password"
          className="w-full rounded-md border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] px-3 py-2 text-sm text-[var(--llx-text-primary)] outline-none transition focus:border-[var(--llx-brand-blurple)]"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--llx-header-secondary)]">
          Confirm password
        </span>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(event) => updateForm("confirmPassword", event.target.value)}
          autoComplete="new-password"
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
        {isSubmitting ? "登録中..." : "アカウントを作成"}
      </button>
    </form>
  );
}
