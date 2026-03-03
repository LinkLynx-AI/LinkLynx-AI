"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { ServerOverview } from "./server/server-overview";
import { ServerRoles } from "./server/server-roles";
import { ServerMembers } from "./server/server-members";
import { ServerEmoji } from "./server/server-emoji";
import { ServerStickers } from "./server/server-stickers";
import { ServerBoost } from "./server/server-boost";
import { ServerAutomod } from "./server/server-automod";
import { ServerAuditLog } from "./server/server-audit-log";
import { ServerInvites } from "./server/server-invites";
import { ServerBans } from "./server/server-bans";
import { ServerAnalytics } from "./server/server-analytics";
import { UserAccount } from "./user/user-account";
import { UserProfile } from "./user/user-profile";
import { UserNitro } from "./user/user-nitro";
import { UserBilling } from "./user/user-billing";
import { UserAppearance } from "./user/user-appearance";
import { UserVoiceVideo } from "./user/user-voice-video";
import { UserNotifications } from "./user/user-notifications";
import { UserKeybinds } from "./user/user-keybinds";
import { UserAccessibility } from "./user/user-accessibility";

type NavSection = {
  label?: string;
  items: { id: string; label: string }[];
};

const serverNav: NavSection[] = [
  {
    items: [
      { id: "overview", label: "概要" },
      { id: "roles", label: "ロール" },
      { id: "emoji", label: "絵文字" },
      { id: "stickers", label: "スタンプ" },
      { id: "boost", label: "サーバーブースト" },
    ],
  },
  {
    label: "モデレーション",
    items: [
      { id: "automod", label: "AutoMod" },
      { id: "audit-log", label: "監査ログ" },
    ],
  },
  {
    items: [
      { id: "members", label: "メンバー" },
      { id: "invites", label: "招待" },
      { id: "bans", label: "BAN" },
    ],
  },
  {
    label: "コミュニティ",
    items: [{ id: "analytics", label: "サーバーインサイト" }],
  },
];

const userNav: NavSection[] = [
  {
    label: "ユーザー設定",
    items: [
      { id: "account", label: "マイアカウント" },
      { id: "profile", label: "プロフィール" },
    ],
  },
  {
    label: "課金設定",
    items: [
      { id: "nitro", label: "Nitro" },
      { id: "billing", label: "請求情報" },
    ],
  },
  {
    label: "アプリの設定",
    items: [
      { id: "appearance", label: "外観" },
      { id: "voice-video", label: "音声・ビデオ" },
      { id: "notifications", label: "通知" },
      { id: "keybinds", label: "キーバインド" },
      { id: "accessibility", label: "アクセシビリティ" },
    ],
  },
];

function PlaceholderPage() {
  return (
    <div className="flex h-full items-center justify-center text-discord-text-muted">
      この設定は準備中です
    </div>
  );
}

export function SettingsLayout({
  type,
  onClose,
  serverId,
}: {
  type: "user" | "server";
  onClose: () => void;
  serverId?: string;
}) {
  const nav = type === "server" ? serverNav : userNav;
  const defaultPage = type === "server" ? "overview" : "account";
  const [activePage, setActivePage] = useState(defaultPage);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function renderContent() {
    if (type === "server") {
      switch (activePage) {
        case "overview":
          return <ServerOverview serverId={serverId ?? ""} />;
        case "roles":
          return <ServerRoles serverId={serverId ?? ""} />;
        case "emoji":
          return <ServerEmoji serverId={serverId ?? ""} />;
        case "stickers":
          return <ServerStickers serverId={serverId ?? ""} />;
        case "boost":
          return <ServerBoost serverId={serverId ?? ""} />;
        case "automod":
          return <ServerAutomod serverId={serverId ?? ""} />;
        case "audit-log":
          return <ServerAuditLog serverId={serverId ?? ""} />;
        case "members":
          return <ServerMembers serverId={serverId ?? ""} />;
        case "invites":
          return <ServerInvites serverId={serverId ?? ""} />;
        case "bans":
          return <ServerBans serverId={serverId ?? ""} />;
        case "analytics":
          return <ServerAnalytics serverId={serverId ?? ""} />;
        default:
          return <PlaceholderPage />;
      }
    }

    switch (activePage) {
      case "account":
        return <UserAccount />;
      case "profile":
        return <UserProfile />;
      case "nitro":
        return <UserNitro />;
      case "billing":
        return <UserBilling />;
      case "appearance":
        return <UserAppearance />;
      case "voice-video":
        return <UserVoiceVideo />;
      case "notifications":
        return <UserNotifications />;
      case "keybinds":
        return <UserKeybinds />;
      case "accessibility":
        return <UserAccessibility />;
      default:
        return <PlaceholderPage />;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-discord-bg-primary">
      {/* Sidebar */}
      <div className="flex flex-1 justify-end bg-discord-bg-secondary">
        <nav className="w-[218px] overflow-y-auto py-[60px] pr-2 pl-5">
          {type === "server" && (
            <div className="mb-1.5 truncate px-2.5 text-xs font-bold uppercase text-discord-header-secondary">
              サーバー名
            </div>
          )}
          {nav.map((section, si) => (
            <div key={si}>
              {si > 0 && <div className="mx-2.5 my-2 h-px bg-discord-divider" />}
              {section.label && (
                <div className="mb-1.5 px-2.5 text-xs font-bold uppercase text-discord-text-muted">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={cn(
                    "mb-0.5 flex w-full items-center rounded px-2.5 py-1.5 text-sm font-medium transition-colors",
                    activePage === item.id
                      ? "bg-discord-bg-mod-active text-discord-interactive-active"
                      : "text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex flex-[1.6]">
        <div className="w-full max-w-[740px] py-[60px] pr-2 pl-10">{renderContent()}</div>

        {/* Close button area */}
        <div className="relative pt-[60px] pl-5">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-discord-interactive-normal text-discord-interactive-normal transition-colors hover:border-discord-interactive-hover hover:text-discord-interactive-hover"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
          <p className="mt-1.5 text-center text-[13px] font-semibold text-discord-interactive-normal">
            ESC
          </p>
        </div>
      </div>
    </div>
  );
}
