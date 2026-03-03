export interface ThreadData {
  id: string;
  name: string;
  parentChannelId: string;
  parentChannelName: string;
  messageCount: number;
  memberCount: number;
  lastMessagePreview: string;
  lastMessageAuthor: string;
  lastActivityAt: string;
  createdAt: string;
  archived: boolean;
  locked: boolean;
  ownerId: string;
}
