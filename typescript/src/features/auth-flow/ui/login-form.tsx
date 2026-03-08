"use client";

import { useState } from "react";
import type { AuthUser } from "@/entities";
import {
  ensurePrincipalProvisionedForCurrentUser,
  loginWithEmailAndPassword,
  signInWithGooglePopup,
} from "@/entities";
import { APP_ROUTES, type LoginRedirectReason, resolvePostAuthRedirectPath } from "@/shared/config";
import Link from "next/link";
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
  inviteCode: string | null;
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
export function LoginForm({ inviteCode, returnTo, reason }: LoginFormProps) {
  const [form, setForm] = useState<LoginFormState>(INITIAL_FORM_STATE);
  const [submitKind, setSubmitKind] = useState<SubmitKind>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = submitKind !== null;
  const reasonMessage = resolveReasonMessage(reason);
  const redirectPath = resolvePostAuthRedirectPath({
    inviteCode,
    returnTo,
  });

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
          returnTo,
          inviteCode,
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
        <label className="block text-xs font-bold uppercase tracking-[0.06em] text-discord-header-secondary">
          メールアドレス <span className="text-discord-brand-red">*</span>
        </label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={(event) => updateForm("email", event.target.value)}
          autoComplete="email"
          placeholder="name@example.com"
          className="h-10 w-full rounded-[3px] bg-discord-bg-tertiary px-[10px] text-sm text-discord-text-normal outline-none transition placeholder:text-discord-text-muted focus:ring-2 focus:ring-discord-brand-blurple/50"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-[0.06em] text-discord-header-secondary">
            パスワード <span className="text-discord-brand-red">*</span>
          </label>
          <Link
            href={APP_ROUTES.passwordReset}
            className="text-xs text-discord-text-link hover:underline"
          >
            パスワードを忘れた場合
          </Link>
        </div>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={(event) => updateForm("password", event.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          className="h-10 w-full rounded-[3px] bg-discord-bg-tertiary px-[10px] text-sm text-discord-text-normal outline-none transition placeholder:text-discord-text-muted focus:ring-2 focus:ring-discord-brand-blurple/50"
        />
      </div>

      {reasonMessage === null ? null : (
        <p className="rounded-[3px] bg-amber-300/10 px-3 py-2 text-sm text-amber-200">
          {reasonMessage}
        </p>
      )}

      {errorMessage === null ? null : (
        <p className="rounded-[3px] bg-discord-brand-red/10 px-3 py-2 text-sm text-discord-brand-red">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 h-11 w-full rounded-[4px] bg-discord-brand-blurple text-sm font-medium text-white transition hover:bg-discord-btn-blurple-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitKind === "email" ? "ログイン中..." : "ログイン"}
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-discord-divider" />
        <span className="text-xs text-discord-text-muted">または</span>
        <div className="h-px flex-1 bg-discord-divider" />
      </div>

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
