"use client";

type GoogleSignInButtonProps = {
  disabled: boolean;
  isSubmitting: boolean;
  onClick: () => void;
};

/**
 * Google サインインを開始するボタンを表示する。
 */
export function GoogleSignInButton({ disabled, isSubmitting, onClick }: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex w-full items-center justify-center rounded-md border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] px-4 py-2 text-sm font-medium text-[var(--llx-text-primary)] transition hover:bg-[var(--llx-bg-selected)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "Googleサインイン中..." : "Googleで続行"}
    </button>
  );
}
