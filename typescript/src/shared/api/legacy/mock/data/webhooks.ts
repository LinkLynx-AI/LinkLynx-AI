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

export const mockWebhooks: WebhookData[] = [
  {
    id: "wh-1",
    name: "GitHub Notifications",
    channelId: "ch-1",
    channelName: "dev-updates",
    avatar: null,
    token: "abc123def456",
    createdAt: "2025-09-15T10:00:00Z",
    lastUsed: "2025-12-01T08:30:00Z",
  },
  {
    id: "wh-2",
    name: "CI/CD Bot",
    channelId: "ch-2",
    channelName: "deployments",
    avatar: null,
    token: "ghi789jkl012",
    createdAt: "2025-10-20T14:30:00Z",
    lastUsed: "2025-11-28T22:15:00Z",
  },
  {
    id: "wh-3",
    name: "RSS Feed",
    channelId: "ch-3",
    channelName: "news",
    avatar: null,
    token: "mno345pqr678",
    createdAt: "2025-11-01T09:00:00Z",
    lastUsed: null,
  },
];
