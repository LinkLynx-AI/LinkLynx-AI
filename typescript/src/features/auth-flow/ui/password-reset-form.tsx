"use client";

import { useState } from "react";
import { sendPasswordResetEmailByAddress } from "@/entities";
import {
  PASSWORD_RESET_COMPLETION_MESSAGE,
  PASSWORD_RESET_RETRY_GUIDANCE_MESSAGE,
  validatePasswordResetInput,
} from "../model";

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
  const hasSubmitted = completionMessage !== null;

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
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-discord-header-secondary">
          メールアドレス <span className="text-discord-brand-red">*</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(event) => setForm({ email: event.target.value })}
          autoComplete="email"
          className="w-full rounded bg-discord-input-bg px-3 py-2.5 text-sm text-discord-text-normal outline-none ring-0 transition focus:ring-2 focus:ring-discord-brand-blurple"
        />
      </div>

      {errorMessage !== null && (
        <p className="rounded bg-discord-brand-red/10 px-3 py-2 text-sm text-discord-brand-red">
          {errorMessage}
        </p>
      )}

      {completionMessage !== null && (
        <div
          className="space-y-2 rounded bg-discord-btn-success/10 px-3 py-2 text-sm text-discord-btn-success"
          aria-live="polite"
        >
          <p>{completionMessage}</p>
          <p className="text-discord-text-muted">{PASSWORD_RESET_RETRY_GUIDANCE_MESSAGE}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded bg-discord-brand-blurple px-4 py-3 text-sm font-medium text-white transition hover:bg-discord-btn-blurple-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "送信中..." : hasSubmitted ? "もう一度送る" : "再設定メールを送る"}
      </button>
    </form>
  );
}
