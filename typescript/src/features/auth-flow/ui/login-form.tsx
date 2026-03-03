"use client";

import { useState } from "react";
import type { AuthUser } from "@/entities";
import {
  ensurePrincipalProvisionedForCurrentUser,
  loginWithEmailAndPassword,
  signInWithGooglePopup,
} from "@/entities";
import { APP_ROUTES, type LoginRedirectReason, normalizeReturnToPath } from "@/shared/config";
import {
  buildVerifyEmailRoute,
  getGoogleSignInErrorMessage,
  getLoginErrorMessage,
  getPrincipalProvisionErrorMessage,
  validateLoginInput,
} from "../model";
import { GoogleSignInButton } from "./google-sign-in-button";

type LoginFormState = {
  email: string;
  password: string;
};

const INITIAL_FORM_STATE: LoginFormState = {
  email: "",
  password: "",
};

type LoginFormProps = {
  returnTo: string | null;
  reason: LoginRedirectReason | null;
};

type SubmitKind = "email" | "google" | null;

function resolveReasonMessage(reason: LoginRedirectReason | null): string | null {
  if (reason === "session-expired") {
    return "セッションの有効期限が切れました。再度ログインしてください。";
  }

  if (reason === "unauthenticated") {
    return "この画面にアクセスするにはログインが必要です。";
  }

  return null;
}

/**
 * ログインフォームを表示し Firebase 認証へ接続する。
 */
export function LoginForm({ returnTo, reason }: LoginFormProps) {
  const [form, setForm] = useState<LoginFormState>(INITIAL_FORM_STATE);
  const [submitKind, setSubmitKind] = useState<SubmitKind>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = submitKind !== null;
  const reasonMessage = resolveReasonMessage(reason);
  const redirectPath = normalizeReturnToPath(returnTo) ?? APP_ROUTES.channels.me;

  function updateForm<K extends keyof LoginFormState>(key: K, value: LoginFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function completeAuthenticatedFlow(user: AuthUser) {
    if (!user.emailVerified) {
      setSubmitKind(null);
      window.location.assign(
        buildVerifyEmailRoute({
          email: user.email,
          returnTo: redirectPath,
        }),
      );
      return;
    }

    const provisionResult = await ensurePrincipalProvisionedForCurrentUser();
    setSubmitKind(null);

    if (!provisionResult.ok) {
      console.warn("Principal provisioning failed after login.", provisionResult.error);
      setErrorMessage(getPrincipalProvisionErrorMessage(provisionResult.error));
      return;
    }

    window.location.assign(redirectPath);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitKind !== null) {
      return;
    }

    setErrorMessage(null);
    const validation = validateLoginInput(form);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setSubmitKind("email");
    const result = await loginWithEmailAndPassword(validation.data);

    if (!result.ok) {
      setSubmitKind(null);
      setErrorMessage(getLoginErrorMessage(result.error));
      return;
    }

    await completeAuthenticatedFlow(result.data);
  }

  async function handleGoogleSignIn() {
    if (submitKind !== null) {
      return;
    }

    setErrorMessage(null);
    setSubmitKind("google");
    const result = await signInWithGooglePopup();

    if (!result.ok) {
      setSubmitKind(null);
      setErrorMessage(getGoogleSignInErrorMessage(result.error));
      return;
    }

    await completeAuthenticatedFlow(result.data);
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

      {reasonMessage === null ? null : (
        <p className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-200">
          {reasonMessage}
        </p>
      )}

      {errorMessage === null ? null : (
        <p className="rounded-md border border-[var(--llx-brand-red)]/40 bg-[var(--llx-brand-red)]/10 px-3 py-2 text-sm text-[var(--llx-brand-red)]">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded bg-discord-brand-blurple px-4 py-3 text-sm font-medium text-white transition hover:bg-discord-btn-blurple-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitKind === "email" ? "ログイン中..." : "ログイン"}
      </button>

      <GoogleSignInButton
        disabled={isSubmitting}
        isSubmitting={submitKind === "google"}
        onClick={() => {
          void handleGoogleSignIn();
        }}
      />
    </form>
  );
}
