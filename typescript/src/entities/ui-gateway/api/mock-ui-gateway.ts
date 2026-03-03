import { APP_ROUTES } from "@/shared/config";
import type {
  AuthRouteContent,
  AuthRouteKind,
  ChannelShellNavigation,
  InvitePageContent,
  MessagePreviewContent,
  ModerationQueueContent,
  PermissionPreviewContent,
  SettingsShellNavigation,
  UiGateway,
} from "../model";

const AUTH_ROUTE_CONTENT: Record<AuthRouteKind, AuthRouteContent> = {
  login: {
    title: "ログイン",
    description: "認証フローのログイン画面です。",
    links: [
      { label: "新規登録へ", href: APP_ROUTES.register },
      { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
      { label: "パスワード再設定へ", href: APP_ROUTES.passwordReset },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  register: {
    title: "新規登録",
    description: "認証フローの新規登録画面です。",
    links: [{ label: "ログインへ", href: APP_ROUTES.login }],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  "verify-email": {
    title: "メール確認",
    description: "認証フローのメール確認画面です。",
    links: [{ label: "ログインへ", href: APP_ROUTES.login }],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  "password-reset": {
    title: "パスワード再設定",
    description: "認証フローのパスワード再設定画面です。",
    links: [{ label: "ログインへ", href: APP_ROUTES.login }],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
};

const CHANNEL_SHELL_NAVIGATION: ChannelShellNavigation = {
  sectionLabel: "Channels",
  serverRailItems: [{ id: "home", label: "Home", href: APP_ROUTES.channels.me, selected: true }],
  channelItems: [
    { id: "me", label: "@me", href: APP_ROUTES.channels.me, kind: "dm", selected: true },
  ],
  memberItems: [],
};

const SETTINGS_SHELL_NAVIGATION: SettingsShellNavigation = {
  sectionLabel: "Settings",
  items: [
    { id: "profile", label: "プロフィール", href: APP_ROUTES.settings.profile, selected: true },
    { id: "appearance", label: "外観", href: APP_ROUTES.settings.appearance, selected: false },
  ],
  closeLink: { label: "閉じる", href: APP_ROUTES.channels.me },
  closeHint: "ESC",
};

const CHANNELS_ME_CONTENT: MessagePreviewContent = {
  title: "@me",
  description: "利用可能な機能を確認するための画面です。",
  quickActions: [],
};

const PROFILE_SETTINGS_CONTENT: MessagePreviewContent = {
  title: "プロフィール設定",
  description: "プロフィール関連の設定画面です。",
  quickActions: [],
};

const APPEARANCE_SETTINGS_CONTENT: MessagePreviewContent = {
  title: "外観設定",
  description: "外観関連の設定画面です。",
  quickActions: [],
};

const MODERATION_PERMISSION_CONTENT: PermissionPreviewContent = {
  title: "権限表示",
  description: "現在は権限プレビュー用データがありません。",
  rows: [],
};

const MODERATION_QUEUE_CONTENT: ModerationQueueContent = {
  title: "通報キュー",
  description: "現在は通報キュー用データがありません。",
  reports: [],
};

/**
 * UI Skeleton 用Gatewayを生成する。
 */
export function createMockUiGateway(): UiGateway {
  return {
    auth: {
      getRouteContent(kind) {
        return Promise.resolve(AUTH_ROUTE_CONTENT[kind]);
      },
    },
    guild: {
      getChannelShellNavigation() {
        return Promise.resolve(CHANNEL_SHELL_NAVIGATION);
      },
      getSettingsShellNavigation() {
        return Promise.resolve(SETTINGS_SHELL_NAVIGATION);
      },
      getInvitePageContent(code: string): Promise<InvitePageContent> {
        const normalizedCode = code.trim();

        return Promise.resolve({
          title: "招待コードを確認",
          description: `招待コード ${normalizedCode} を確認しています。`,
          primaryAction: { label: "ログインして参加", href: APP_ROUTES.login },
          secondaryAction: { label: "ホームへ戻る", href: APP_ROUTES.home },
        });
      },
    },
    message: {
      getChannelsMeContent() {
        return Promise.resolve(CHANNELS_ME_CONTENT);
      },
      getChannelContent(input) {
        return Promise.resolve({
          title: `#${input.channelId}`,
          description: `${input.guildId} のチャンネル情報です。`,
          quickActions: [],
        });
      },
      getProfileSettingsContent() {
        return Promise.resolve(PROFILE_SETTINGS_CONTENT);
      },
      getAppearanceSettingsContent() {
        return Promise.resolve(APPEARANCE_SETTINGS_CONTENT);
      },
    },
    moderation: {
      getPermissionPreviewContent() {
        return Promise.resolve(MODERATION_PERMISSION_CONTENT);
      },
      getModerationQueueContent() {
        return Promise.resolve(MODERATION_QUEUE_CONTENT);
      },
    },
  };
}
