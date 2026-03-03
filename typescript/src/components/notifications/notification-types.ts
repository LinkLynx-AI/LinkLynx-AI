export interface NotificationData {
  id: string;
  type: "message" | "mention" | "reply" | "friend_request";
  serverId?: string;
  serverName?: string;
  serverIcon?: string;
  channelId?: string;
  channelName?: string;
  author: { displayName: string; avatar: string | null };
  content: string;
  timestamp: string;
  read: boolean;
}
