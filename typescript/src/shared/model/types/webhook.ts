export type Webhook = {
  id: string;
  type: 1 | 2 | 3;
  guildId: string;
  channelId: string;
  name: string;
  avatar: string | null;
  token?: string;
  applicationId?: string;
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
};

export type WebhookCreateData = {
  name: string;
  avatar?: string;
  channelId: string;
};

export type WebhookUpdateData = Partial<Pick<Webhook, "name" | "avatar" | "channelId">>;
