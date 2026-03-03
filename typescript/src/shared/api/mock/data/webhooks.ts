export type WebhookData = {
  id: string;
  name: string;
  channelId: string;
  channelName: string;
  avatar: string | null;
  token: string;
  createdAt: string;
  lastUsed: string | null;
};

export const mockWebhooks: WebhookData[] = [];
