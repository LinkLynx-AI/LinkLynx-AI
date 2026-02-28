export type UiGatewayLink = {
  label: string;
  href: string;
  description?: string;
};

export type UiGatewayProvider = "mock" | "api";

export type AuthRouteKind = "login" | "register" | "verify-email" | "password-reset";

export type AuthRouteContent = {
  title: string;
  description: string;
  links: ReadonlyArray<UiGatewayLink>;
  footerLink: UiGatewayLink;
};

export type ServerRailItem = {
  id: string;
  label: string;
  href: string;
  selected: boolean;
  unread?: boolean;
  unreadCount?: number;
  muted?: boolean;
};

export type ChannelListItemKind = "dm" | "text" | "settings";

export type ChannelListSection = "dm" | "channels" | "shortcuts";

export type ChannelListItem = {
  id: string;
  label: string;
  href: string;
  kind: ChannelListItemKind;
  section: ChannelListSection;
  selected: boolean;
  unread?: boolean;
  unreadCount?: number;
  muted?: boolean;
  statusLabel?: string;
};

export type MemberPresence = "online" | "idle" | "dnd" | "offline";

export type MemberListItem = {
  id: string;
  name: string;
  presence: MemberPresence;
  roleLabel?: string;
};

export type ChannelShellNavigation = {
  sectionLabel: string;
  serverRailItems: ReadonlyArray<ServerRailItem>;
  channelItems: ReadonlyArray<ChannelListItem>;
  memberItems: ReadonlyArray<MemberListItem>;
};

export type SettingsNavigationItem = {
  id: string;
  label: string;
  href: string;
  selected: boolean;
};

export type SettingsShellNavigation = {
  sectionLabel: string;
  items: ReadonlyArray<SettingsNavigationItem>;
  closeLink: UiGatewayLink;
  closeHint: string;
};

export type InvitePageStatus = "valid" | "invalid" | "expired";

export type InvitePageContent = {
  status: InvitePageStatus;
  title: string;
  description: string;
  guildName?: string;
  memberCountLabel?: string;
  primaryAction: UiGatewayLink;
  secondaryAction: UiGatewayLink;
  recoveryActions: ReadonlyArray<UiGatewayLink>;
};

export type ConversationContextKind = "channel" | "dm";

export type ConversationHeaderAction = {
  id: string;
  icon: string;
  label: string;
};

export type ConversationMessageState = "sent" | "pending" | "failed" | "edited" | "deleted";

export type ConversationMessageAction = "retry" | "jump" | "edit" | "delete";

export type ConversationMessage = {
  id: string;
  authorName: string;
  avatarText: string;
  timestampLabel: string;
  body: string;
  state: ConversationMessageState;
  compact?: boolean;
  system?: boolean;
  actions: ReadonlyArray<ConversationMessageAction>;
};

export type ConversationComposerState = "idle" | "typing";

export type ConversationComposer = {
  placeholder: string;
  draftText?: string;
  hint: string;
  state: ConversationComposerState;
};

export type ConversationPreviewContent = {
  context: ConversationContextKind;
  title: string;
  subtitle: string;
  headerIcon: string;
  headerActions: ReadonlyArray<ConversationHeaderAction>;
  messages: ReadonlyArray<ConversationMessage>;
  composer: ConversationComposer;
  quickActions: ReadonlyArray<UiGatewayLink>;
};

export type MessagePreviewContent = {
  title: string;
  description: string;
  quickActions: ReadonlyArray<UiGatewayLink>;
};

export type PermissionVisibilityRow = {
  id: string;
  roleName: string;
  canRead: boolean;
  canPost: boolean;
};

export type PermissionPreviewContent = {
  title: string;
  description: string;
  rows: ReadonlyArray<PermissionVisibilityRow>;
};

export type ModerationReportSummary = {
  id: string;
  title: string;
  status: "open" | "investigating" | "resolved";
  reporter: string;
};

export type ModerationQueueContent = {
  title: string;
  description: string;
  reports: ReadonlyArray<ModerationReportSummary>;
};

export type AuthUiGateway = {
  getRouteContent(kind: AuthRouteKind): Promise<AuthRouteContent>;
};

export type GuildUiGateway = {
  getChannelShellNavigation(): Promise<ChannelShellNavigation>;
  getSettingsShellNavigation(): Promise<SettingsShellNavigation>;
  getInvitePageContent(code: string): Promise<InvitePageContent>;
};

export type MessageUiGateway = {
  getChannelsMeContent(): Promise<ConversationPreviewContent>;
  getChannelContent(input: {
    guildId: string;
    channelId: string;
  }): Promise<ConversationPreviewContent>;
  getProfileSettingsContent(): Promise<MessagePreviewContent>;
  getAppearanceSettingsContent(): Promise<MessagePreviewContent>;
};

export type ModerationUiGateway = {
  getPermissionPreviewContent(): Promise<PermissionPreviewContent>;
  getModerationQueueContent(): Promise<ModerationQueueContent>;
};

export type UiGateway = {
  auth: AuthUiGateway;
  guild: GuildUiGateway;
  message: MessageUiGateway;
  moderation: ModerationUiGateway;
};
