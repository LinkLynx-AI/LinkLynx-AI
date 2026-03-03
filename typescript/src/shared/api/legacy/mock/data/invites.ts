export type Invite = {
  code: string;
  channelName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
};

export const mockInvites: Invite[] = [];
