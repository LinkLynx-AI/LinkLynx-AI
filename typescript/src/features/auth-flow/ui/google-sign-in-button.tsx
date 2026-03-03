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
      className="h-10 w-full rounded-[4px] bg-discord-bg-tertiary text-sm font-medium text-discord-text-normal transition hover:bg-discord-bg-mod-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "Googleサインイン中..." : "Googleで続行"}
    </button>
  );
}
