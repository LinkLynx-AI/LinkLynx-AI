import { APP_ROUTES, buildChannelRoute } from "@/shared/config";
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
    description: "Firebase ログインの動作確認と導線遷移を行う画面です。",
    links: [
      { label: "新規登録へ", href: APP_ROUTES.register },
      { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
      { label: "パスワード再設定へ", href: APP_ROUTES.passwordReset },
      { label: "ログイン後の遷移先 (@me)", href: APP_ROUTES.channels.me },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  register: {
    title: "新規登録",
    description: "Firebase へ新規登録し、確認メール導線へ進む画面です。",
    links: [
      { label: "ログインへ", href: APP_ROUTES.login },
      { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
      { label: "ホームへ", href: APP_ROUTES.home },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  "verify-email": {
    title: "メール確認",
    description: "確認メールの再送と確認状態更新を行う画面です。",
    links: [
      { label: "ログインへ", href: APP_ROUTES.login },
      { label: "パスワード再設定へ", href: APP_ROUTES.passwordReset },
      { label: "認証後の遷移先 (@me)", href: APP_ROUTES.channels.me },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  "password-reset": {
    title: "パスワード再設定",
    description: "Firebase にパスワード再設定メール送信を依頼する画面です。",
    links: [
      { label: "ログインへ戻る", href: APP_ROUTES.login },
      { label: "新規登録へ", href: APP_ROUTES.register },
      { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
};

const CHANNEL_SHELL_NAVIGATION: ChannelShellNavigation = {
  sectionLabel: "Channels",
  serverRailItems: [
    { id: "home", label: "Home", href: APP_ROUTES.channels.me, selected: true },
    {
      id: "srv-1",
      label: "AB",
      href: buildChannelRoute("guild-1", "channel-general"),
      selected: false,
    },
    {
      id: "srv-2",
      label: "CD",
      href: buildChannelRoute("guild-2", "channel-general"),
      selected: false,
    },
    {
      id: "srv-3",
      label: "EF",
      href: buildChannelRoute("guild-3", "channel-general"),
      selected: false,
    },
  ],
  channelItems: [
    { id: "me", label: "@me", href: APP_ROUTES.channels.me, kind: "dm", selected: false },
    {
      id: "general",
      label: "general",
      href: buildChannelRoute("guild-1", "channel-general"),
      kind: "text",
      selected: true,
    },
    {
      id: "random",
      label: "random",
      href: buildChannelRoute("guild-1", "channel-random"),
      kind: "text",
      selected: false,
    },
    {
      id: "settings",
      label: "設定へ",
      href: APP_ROUTES.settings.profile,
      kind: "settings",
      selected: false,
    },
  ],
  memberItems: [
    { id: "alice", name: "Alice" },
    { id: "bob", name: "Bob" },
    { id: "carol", name: "Carol" },
  ],
};

const SETTINGS_SHELL_NAVIGATION: SettingsShellNavigation = {
  sectionLabel: "Settings",
  items: [
    { id: "profile", label: "プロフィール", href: APP_ROUTES.settings.profile, selected: true },
    { id: "appearance", label: "外観", href: APP_ROUTES.settings.appearance, selected: false },
    { id: "back", label: "チャンネルへ戻る", href: APP_ROUTES.channels.me, selected: false },
  ],
  closeLink: { label: "閉じる", href: APP_ROUTES.channels.me },
  closeHint: "ESC",
};

const CHANNELS_ME_CONTENT: MessagePreviewContent = {
  title: "@me ダッシュボード",
  description:
    "保護ルートの表示プレビューです。`?state=loading|empty|error|readonly|disabled` または `?guard=unauthenticated|forbidden|not-found` を付与して状態を確認できます。",
  quickActions: [
    { label: "loading", href: `${APP_ROUTES.channels.me}?state=loading` },
    { label: "unauthenticated", href: `${APP_ROUTES.channels.me}?guard=unauthenticated` },
  ],
};

const PROFILE_SETTINGS_CONTENT: MessagePreviewContent = {
  title: "プロフィール設定",
  description: "設定App Shellのプレビューです。`state` クエリで共通プレースホルダを確認できます。",
  quickActions: [
    { label: "readonly", href: `${APP_ROUTES.settings.profile}?state=readonly` },
    { label: "forbidden", href: `${APP_ROUTES.settings.profile}?guard=forbidden` },
  ],
};

const APPEARANCE_SETTINGS_CONTENT: MessagePreviewContent = {
  title: "外観設定",
  description: "テーマ切替導線のプレビューです。`state=disabled` などの共通状態を確認できます。",
  quickActions: [
    { label: "disabled", href: `${APP_ROUTES.settings.appearance}?state=disabled` },
    { label: "error", href: `${APP_ROUTES.settings.appearance}?state=error` },
  ],
};

const MODERATION_PERMISSION_CONTENT: PermissionPreviewContent = {
  title: "権限表示プレビュー",
  description: "role別の閲覧/投稿可否を表形式で確認するためのモックデータです。",
  rows: [
    { id: "admin", roleName: "Admin", canRead: true, canPost: true },
    { id: "mod", roleName: "Moderator", canRead: true, canPost: true },
    { id: "member", roleName: "Member", canRead: true, canPost: false },
  ],
};

const MODERATION_QUEUE_CONTENT: ModerationQueueContent = {
  title: "通報キュー",
  description: "最小モデレーションUI向けの queue/list/detail プレビュー用モックです。",
  reports: [
    { id: "r-001", title: "スパム投稿", status: "open", reporter: "Alice" },
    { id: "r-002", title: "荒らし行為", status: "investigating", reporter: "Bob" },
  ],
};

/**
 * UI Skeleton 用のモックGatewayを生成する。
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
          description: `招待コード ${normalizedCode} の表示プレビューです。`,
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
          title: `#${input.channelId} (${input.guildId})`,
          description:
            "チャンネル詳細ルートのプレビューです。状態切替は `state` / `guard` クエリで確認できます。",
          quickActions: [
            { label: "empty", href: `${APP_ROUTES.channels.me}?state=empty` },
            { label: "not-found", href: `${APP_ROUTES.channels.me}?guard=not-found` },
          ],
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
