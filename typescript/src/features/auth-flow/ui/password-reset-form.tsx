"use client";

import { useState } from "react";
import { sendPasswordResetEmailByAddress } from "@/entities";
import { PASSWORD_RESET_COMPLETION_MESSAGE, validatePasswordResetInput } from "../model";

type PasswordResetFormState = {
  email: string;
};

const INITIAL_FORM_STATE: PasswordResetFormState = {
  email: "",
};

/**
 * パスワード再設定メール送信フォームを表示する。
 */
export function PasswordResetForm() {
  const [form, setForm] = useState<PasswordResetFormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    const validation = validatePasswordResetInput(form);
    if (!validation.ok) {
      setCompletionMessage(null);
      setErrorMessage(validation.message);
      return;
    }

    setIsSubmitting(true);
    const result = await sendPasswordResetEmailByAddress(validation.data);
    setIsSubmitting(false);

    if (!result.ok) {
      console.warn("Password reset mail request failed.", result.error);
    }

    setCompletionMessage(PASSWORD_RESET_COMPLETION_MESSAGE);
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
          onChange={(event) => setForm({ email: event.target.value })}
          autoComplete="email"
          className="w-full rounded-md border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] px-3 py-2 text-sm text-[var(--llx-text-primary)] outline-none transition focus:border-[var(--llx-brand-blurple)]"
        />
      </label>

      {errorMessage === null ? null : (
        <p className="rounded-md border border-[var(--llx-brand-red)]/40 bg-[var(--llx-brand-red)]/10 px-3 py-2 text-sm text-[var(--llx-brand-red)]">
          {errorMessage}
        </p>
      )}

      {completionMessage === null ? null : (
        <p className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          {completionMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-[var(--llx-brand-blurple)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "送信中..." : "再設定メールを送る"}
      </button>
    </form>
  );
}
