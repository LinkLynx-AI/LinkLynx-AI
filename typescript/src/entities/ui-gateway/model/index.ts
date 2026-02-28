export type UiGatewayLink = {
  label: string;
  href: string;
};

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
};

export type ChannelListItemKind = "dm" | "text" | "settings";

export type ChannelListItem = {
  id: string;
  label: string;
  href: string;
  kind: ChannelListItemKind;
  selected: boolean;
};

export type MemberListItem = {
  id: string;
  name: string;
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

export type InvitePageContent = {
  title: string;
  description: string;
  primaryAction: UiGatewayLink;
  secondaryAction: UiGatewayLink;
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
  getChannelsMeContent(): Promise<MessagePreviewContent>;
  getChannelContent(input: { guildId: string; channelId: string }): Promise<MessagePreviewContent>;
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
