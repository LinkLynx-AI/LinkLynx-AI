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

export const mockInvites: Invite[] = [
  {
    code: "abc123",
    channelName: "#general",
    creatorUsername: "alice",
    creatorAvatar: null,
    uses: 15,
    maxUses: 100,
    expiresAt: "2026-01-15T00:00:00Z",
    createdAt: "2025-12-01T10:00:00Z",
  },
  {
    code: "xyz789",
    channelName: "#welcome",
    creatorUsername: "bob",
    creatorAvatar: null,
    uses: 42,
    maxUses: null,
    expiresAt: null,
    createdAt: "2025-11-20T08:30:00Z",
  },
  {
    code: "def456",
    channelName: "#gaming",
    creatorUsername: "charlie",
    creatorAvatar: null,
    uses: 3,
    maxUses: 10,
    expiresAt: "2025-12-31T23:59:59Z",
    createdAt: "2025-11-28T14:00:00Z",
  },
  {
    code: "ghi012",
    channelName: "#announcements",
    creatorUsername: "alice",
    creatorAvatar: null,
    uses: 0,
    maxUses: 50,
    expiresAt: "2026-02-01T00:00:00Z",
    createdAt: "2025-12-01T12:00:00Z",
  },
  {
    code: "jkl345",
    channelName: "#art",
    creatorUsername: "bob",
    creatorAvatar: null,
    uses: 8,
    maxUses: 25,
    expiresAt: null,
    createdAt: "2025-11-15T16:45:00Z",
  },
  {
    code: "mno678",
    channelName: "#voice-lounge",
    creatorUsername: "charlie",
    creatorAvatar: null,
    uses: 1,
    maxUses: 5,
    expiresAt: "2025-12-15T00:00:00Z",
    createdAt: "2025-12-01T09:00:00Z",
  },
];
