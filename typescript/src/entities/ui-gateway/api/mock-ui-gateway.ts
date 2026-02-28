import { APP_ROUTES, buildChannelRoute, buildInviteRoute, buildLoginRoute } from "@/shared/config";
import type {
  AuthRouteContent,
  AuthRouteKind,
  ChannelShellNavigation,
  ConversationPreviewContent,
  InvitePageContent,
  InvitePageStatus,
  MessagePreviewContent,
  ModerationQueueContent,
  PermissionPreviewContent,
  SettingsShellNavigation,
  UiGateway,
} from "../model";

const AUTH_ROUTE_CONTENT: Record<AuthRouteKind, AuthRouteContent> = {
  login: {
    title: "ログイン",
    description: "未実装の認証処理を想定した導線プレビューです。",
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
    description: "登録フォームのUI先行レビュー用ページです。",
    links: [
      { label: "ログインへ", href: APP_ROUTES.login },
      { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
      { label: "ホームへ", href: APP_ROUTES.home },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  "verify-email": {
    title: "メール確認",
    description: "確認メール送信後の状態を想定した画面プレビューです。",
    links: [
      { label: "ログインへ", href: APP_ROUTES.login },
      { label: "パスワード再設定へ", href: APP_ROUTES.passwordReset },
      { label: "認証後の遷移先 (@me)", href: APP_ROUTES.channels.me },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
  "password-reset": {
    title: "パスワード再設定",
    description: "パスワード再設定フローの表示確認用プレビューです。",
    links: [
      { label: "ログインへ戻る", href: APP_ROUTES.login },
      { label: "新規登録へ", href: APP_ROUTES.register },
      { label: "メール確認へ", href: APP_ROUTES.verifyEmail },
    ],
    footerLink: { label: "ホームへ戻る", href: APP_ROUTES.home },
  },
};

const CHANNEL_SHELL_NAVIGATION: ChannelShellNavigation = {
  sectionLabel: "AI_discord",
  serverRailItems: [
    {
      id: "home",
      label: "友",
      href: APP_ROUTES.channels.me,
      selected: true,
      unread: true,
      unreadCount: 3,
    },
    {
      id: "srv-1",
      label: "AI",
      href: buildChannelRoute("guild-1", "times-abe"),
      selected: false,
      unread: true,
      unreadCount: 9,
    },
    {
      id: "srv-2",
      label: "北",
      href: buildChannelRoute("guild-2", "channel-general"),
      selected: false,
    },
    {
      id: "srv-3",
      label: "や",
      href: buildChannelRoute("guild-3", "channel-random"),
      selected: false,
      muted: true,
    },
  ],
  channelItems: [
    {
      id: "friends",
      label: "フレンド",
      href: APP_ROUTES.channels.me,
      kind: "dm",
      section: "shortcuts",
      selected: true,
    },
    {
      id: "dm-kiwasa",
      label: "kiwasa",
      href: APP_ROUTES.channels.me,
      kind: "dm",
      section: "dm",
      selected: false,
      unread: true,
      unreadCount: 2,
      statusLabel: "オンライン",
    },
    {
      id: "dm-miwasa",
      label: "miwasa",
      href: APP_ROUTES.channels.me,
      kind: "dm",
      section: "dm",
      selected: false,
      muted: true,
      statusLabel: "離席中",
    },
    {
      id: "times-yzen",
      label: "times-yzen",
      href: buildChannelRoute("guild-1", "times-yzen"),
      kind: "text",
      section: "channels",
      selected: false,
      unread: true,
      unreadCount: 3,
    },
    {
      id: "times-miwasa",
      label: "times-miwasa",
      href: buildChannelRoute("guild-1", "times-miwasa"),
      kind: "text",
      section: "channels",
      selected: false,
    },
    {
      id: "times-abe",
      label: "times-abe",
      href: buildChannelRoute("guild-1", "times-abe"),
      kind: "text",
      section: "channels",
      selected: true,
    },
    {
      id: "settings",
      label: "設定へ",
      href: APP_ROUTES.settings.profile,
      kind: "settings",
      section: "shortcuts",
      selected: false,
    },
  ],
  memberItems: [
    { id: "kiwasa", name: "kiwasa", presence: "online", roleLabel: "Member" },
    { id: "miwasa", name: "miwasa", presence: "idle", roleLabel: "Member" },
    { id: "sabe", name: "sabe", presence: "online", roleLabel: "Admin" },
    { id: "yzen", name: "yzen", presence: "dnd", roleLabel: "Member" },
    { id: "hmaruyam", name: "hmaruyam", presence: "offline", roleLabel: "Member" },
    { id: "kyosuke", name: "kyosuke", presence: "offline", roleLabel: "Member" },
    { id: "rookuma", name: "rookuma", presence: "offline", roleLabel: "Member" },
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

function buildConversationQuickActions(baseHref: string) {
  return [
    { label: "loading", href: `${baseHref}?state=loading` },
    { label: "empty", href: `${baseHref}?state=empty` },
    { label: "error", href: `${baseHref}?state=error` },
    { label: "unauthenticated", href: `${baseHref}?guard=unauthenticated` },
    { label: "forbidden", href: `${baseHref}?guard=forbidden` },
  ] as const;
}

function createDmConversationContent(): ConversationPreviewContent {
  return {
    context: "dm",
    title: "kiwasa",
    subtitle: "最終オンライン: 3分前",
    headerIcon: "@",
    headerActions: [
      { id: "call", icon: "☎", label: "通話" },
      { id: "video", icon: "▣", label: "ビデオ" },
      { id: "pin", icon: "⌖", label: "ピン留め" },
      { id: "add", icon: "⊕", label: "メンバー追加" },
    ],
    messages: [
      {
        id: "dm-1",
        authorName: "kiwasa",
        avatarText: "KI",
        timestampLabel: "昨日 23:45",
        body: "v1のuiタスクの後半、Discord画面にかなり寄せたい。",
        state: "sent",
        actions: ["jump", "edit", "delete"],
      },
      {
        id: "dm-2",
        authorName: "sabe",
        avatarText: "SB",
        timestampLabel: "今日 1:41",
        body: "UI / postgres系API / 契約整理を並行で進める。",
        state: "edited",
        actions: ["jump", "edit", "delete"],
      },
      {
        id: "dm-3",
        authorName: "sabe",
        avatarText: "SB",
        timestampLabel: "今日 2:40",
        body: "UI甘すぎてダメ、pencilの見た目に寄せて再修正します。",
        state: "pending",
        actions: ["jump", "delete"],
      },
    ],
    composer: {
      placeholder: "@kiwasaへメッセージを送信",
      draftText: "UIの密度をDiscordに合わせて調整中。",
      hint: "Enter で送信 / Shift+Enter で改行",
      state: "typing",
    },
    quickActions: buildConversationQuickActions(APP_ROUTES.channels.me),
  };
}

function createChannelConversationContent(
  guildId: string,
  channelId: string,
): ConversationPreviewContent {
  const route = buildChannelRoute(guildId, channelId);

  return {
    context: "channel",
    title: `# ${channelId}`,
    subtitle: "UI実装タスクの同期チャンネル",
    headerIcon: "#",
    headerActions: [
      { id: "threads", icon: "⌇", label: "スレッド一覧" },
      { id: "notify", icon: "🔔", label: "通知" },
      { id: "pin", icon: "⌖", label: "ピン" },
      { id: "members", icon: "👥", label: "メンバー一覧" },
    ],
    messages: [
      {
        id: "ch-1",
        authorName: "sabe",
        avatarText: "SB",
        timestampLabel: "昨日 23:45",
        body: "直近やるべきこと: UI / postgres系API / 契約整理。",
        state: "sent",
        actions: ["jump", "edit", "delete"],
      },
      {
        id: "ch-2",
        authorName: "sabe",
        avatarText: "SB",
        timestampLabel: "今日 1:55",
        body: "postgres実APIは今うんちょい残り。契約はdocs移植で進める。",
        state: "edited",
        actions: ["jump", "edit", "delete"],
      },
      {
        id: "ch-3",
        authorName: "sabe",
        avatarText: "SB",
        timestampLabel: "今日 2:03",
        body: "scylla/ws契約が固まればAPI実装が可能になるはず。",
        state: "failed",
        actions: ["retry", "jump", "delete"],
      },
      {
        id: "ch-4",
        authorName: "sabe",
        avatarText: "SB",
        timestampLabel: "今日 2:23",
        body: "このメッセージは削除されました。",
        state: "deleted",
        compact: true,
        actions: ["jump"],
      },
      {
        id: "ch-5",
        authorName: "System",
        avatarText: "SY",
        timestampLabel: "今日 2:30",
        body: "kiwasa が #times-abe に参加しました。",
        state: "sent",
        compact: true,
        system: true,
        actions: ["jump"],
      },
      {
        id: "ch-6",
        authorName: "sabe",
        avatarText: "SB",
        timestampLabel: "今日 2:40",
        body: "UIミカスぎてダメ。本当にpencil見てるとは思えないから要修正。",
        state: "pending",
        actions: ["jump", "delete"],
      },
    ],
    composer: {
      placeholder: `#${channelId} へメッセージを送信`,
      hint: "Ctrl+K でクイックスイッチャー / Enter で送信",
      state: "idle",
    },
    quickActions: buildConversationQuickActions(route),
  };
}

function resolveInviteStatus(code: string): InvitePageStatus {
  const normalizedCode = code.trim().toLowerCase();

  if (normalizedCode.includes("expired") || normalizedCode.includes("ttl")) {
    return "expired";
  }

  if (normalizedCode.includes("invalid") || normalizedCode.includes("not-found")) {
    return "invalid";
  }

  return "valid";
}

function createInviteContent(code: string): InvitePageContent {
  const normalizedCode = code.trim();
  const invitePath = buildInviteRoute(normalizedCode);
  const status = resolveInviteStatus(normalizedCode);

  if (status === "expired") {
    return {
      status,
      title: "この招待リンクは期限切れです",
      description: `招待コード ${normalizedCode} は有効期限を過ぎています。新しい招待を発行してもらってください。`,
      primaryAction: { label: "新しい招待を依頼", href: APP_ROUTES.channels.me },
      secondaryAction: { label: "ホームへ戻る", href: APP_ROUTES.home },
      recoveryActions: [{ label: "ログイン画面へ", href: APP_ROUTES.login }],
    };
  }

  if (status === "invalid") {
    return {
      status,
      title: "この招待リンクは無効です",
      description: `招待コード ${normalizedCode} が見つかりません。入力ミスか、すでに無効化されています。`,
      primaryAction: { label: "正しい招待リンクを開く", href: APP_ROUTES.home },
      secondaryAction: { label: "ホームへ戻る", href: APP_ROUTES.home },
      recoveryActions: [{ label: "ログインしてサーバー一覧へ", href: APP_ROUTES.channels.me }],
    };
  }

  return {
    status,
    title: "AI_discord への招待",
    description: "この招待リンクからサーバーに参加できます。認証後は招待ページに復帰します。",
    guildName: "AI_discord",
    memberCountLabel: "オンライン 128 / メンバー 1,024",
    primaryAction: {
      label: "ログインして参加",
      href: buildLoginRoute(invitePath),
      description: "認証後に招待ページへ戻ります",
    },
    secondaryAction: { label: "ホームへ戻る", href: APP_ROUTES.home },
    recoveryActions: [
      {
        label: "新規登録して参加",
        href: `${APP_ROUTES.register}?redirect=${encodeURIComponent(invitePath)}`,
      },
    ],
  };
}

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
        return Promise.resolve(createInviteContent(code));
      },
    },
    message: {
      getChannelsMeContent() {
        return Promise.resolve(createDmConversationContent());
      },
      getChannelContent(input) {
        return Promise.resolve(createChannelConversationContent(input.guildId, input.channelId));
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
