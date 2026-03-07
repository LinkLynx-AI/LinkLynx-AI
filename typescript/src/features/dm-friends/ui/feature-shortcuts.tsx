"use client";

import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { useUIStore, type ModalType } from "@/shared/model/stores/ui-store";
import { useAuthStore } from "@/shared/model/stores/auth-store";

type RouteShortcut = {
  href: string;
  label: string;
};

type ModalShortcut = {
  modal: ModalType;
  label: string;
  props?: Record<string, unknown>;
  disabled?: boolean;
};

const ROUTE_SHORTCUTS: RouteShortcut[] = [
  { href: "/channels/me", label: "フレンド" },
  { href: "/login", label: "ログイン" },
  { href: "/register", label: "新規登録" },
  { href: "/verify-email", label: "メール確認" },
  { href: "/password-reset", label: "パスワード再設定" },
];

function ShortcutButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 text-xs font-medium transition-colors",
        "bg-discord-bg-tertiary text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

export function FeatureShortcuts() {
  const openModal = useUIStore((s) => s.openModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const currentUser = useAuthStore((s) => s.currentUser);

  const modalShortcuts: ModalShortcut[] = [
    { modal: "quick-switcher", label: "クイックスイッチャー" },
    { modal: "keyboard-shortcuts", label: "ショートカット一覧" },
    { modal: "create-server", label: "サーバー作成" },
    { modal: "join-server", label: "サーバー参加" },
    { modal: "create-channel", label: "チャンネル作成" },
    { modal: "create-invite", label: "招待作成", disabled: true },
    {
      modal: "delete-confirm",
      label: "削除確認",
      props: {
        title: "削除確認",
        description: "この操作は取り消せません。",
        confirmLabel: "削除",
        onConfirm: closeModal,
      },
    },
    { modal: "user-settings", label: "ユーザー設定" },
    { modal: "server-settings", label: "サーバー設定" },
    {
      modal: "user-profile",
      label: "ユーザープロフィール",
      props: currentUser ? { userId: currentUser.id } : undefined,
      disabled: !currentUser,
    },
    { modal: "status-settings", label: "ステータス設定" },
    { modal: "forward-message", label: "メッセージ転送" },
    { modal: "welcome-screen", label: "ウェルカム画面" },
    { modal: "channel-edit", label: "チャンネル編集" },
    { modal: "onboarding", label: "オンボーディング" },
    {
      modal: "external-link",
      label: "外部リンク確認",
      props: { url: "https://example.com" },
    },
    { modal: "nsfw-warning", label: "NSFW警告", props: { onConfirm: closeModal } },
    { modal: "file-warning", label: "ファイル警告", props: { filename: "" } },
    { modal: "pin-confirm", label: "ピン確認", props: { action: "pin", currentPinCount: 0 } },
    { modal: "reaction-detail", label: "リアクション詳細" },
    { modal: "app-directory", label: "App Directory" },
    { modal: "poll-voters", label: "投票者一覧" },
    { modal: "server-template", label: "サーバーテンプレート" },
  ];

  return (
    <section className="border-b border-discord-divider px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
        利用可能機能ショートカット
      </p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {ROUTE_SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.href}
            href={shortcut.href}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              "bg-discord-bg-tertiary text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
            )}
          >
            {shortcut.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {modalShortcuts.map((shortcut) => (
          <ShortcutButton
            key={shortcut.label}
            disabled={shortcut.disabled}
            onClick={() => openModal(shortcut.modal, shortcut.props)}
          >
            {shortcut.label}
          </ShortcutButton>
        ))}
      </div>
    </section>
  );
}
