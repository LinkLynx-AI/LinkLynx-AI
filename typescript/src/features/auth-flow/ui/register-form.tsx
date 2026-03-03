"use client";

import { useState } from "react";
import type { AuthUser } from "@/entities";
import {
  ensurePrincipalProvisionedForCurrentUser,
  registerWithEmailAndPassword,
  sendVerificationEmailForCurrentUser,
  signInWithGooglePopup,
} from "@/entities";
import { APP_ROUTES } from "@/shared/config";
import {
  buildVerifyEmailRoute,
  getGoogleSignInErrorMessage,
  getPrincipalProvisionErrorMessage,
  getRegisterErrorMessage,
  validateRegisterInput,
} from "../model";
import { GoogleSignInButton } from "./google-sign-in-button";

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

type SubmitKind = "email" | "google" | null;

/**
 * 新規登録フォームを表示し Firebase へ接続する。
 */
export function RegisterForm() {
  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM_STATE);
  const [submitKind, setSubmitKind] = useState<SubmitKind>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = submitKind !== null;

  function updateForm<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function ensurePrincipalAndRedirect() {
    const provisionResult = await ensurePrincipalProvisionedForCurrentUser();
    setSubmitKind(null);

    if (!provisionResult.ok) {
      console.warn("Principal provisioning failed after register.", provisionResult.error);
      setErrorMessage(getPrincipalProvisionErrorMessage(provisionResult.error));
      return;
    }

    window.location.assign(APP_ROUTES.channels.me);
  }

  function routeToVerifyEmail(user: AuthUser, sent?: boolean) {
    setSubmitKind(null);
    const route =
      sent === undefined
        ? buildVerifyEmailRoute({
            email: user.email,
          })
        : buildVerifyEmailRoute({
            email: user.email,
            sent,
          });
    window.location.assign(route);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitKind !== null) {
      return;
    }

    setErrorMessage(null);
    const validation = validateRegisterInput(form);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setSubmitKind("email");
    const registerResult = await registerWithEmailAndPassword({
      email: validation.data.email,
      password: validation.data.password,
    });

    if (!registerResult.ok) {
      setSubmitKind(null);
      setErrorMessage(getRegisterErrorMessage(registerResult.error));
      return;
    }

    if (registerResult.data.emailVerified) {
      await ensurePrincipalAndRedirect();
      return;
    }

    const verifyEmailResult = await sendVerificationEmailForCurrentUser();
    setSubmitKind(null);

    if (!verifyEmailResult.ok) {
      console.warn("Verification mail sending failed after register.", verifyEmailResult.error);
    }

    routeToVerifyEmail(
      {
        ...registerResult.data,
        email: registerResult.data.email ?? validation.data.email,
      },
      verifyEmailResult.ok,
    );
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

    if (!result.data.emailVerified) {
      routeToVerifyEmail(result.data);
      return;
    }

    await ensurePrincipalAndRedirect();
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
        {submitKind === "email" ? "登録中..." : "アカウントを作成"}
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
