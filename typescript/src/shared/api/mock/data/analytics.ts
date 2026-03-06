export type DailyStats = {
  date: string;
  totalMembers: number;
  activeMembers: number;
  newMembers: number;
  messageCount: number;
};

export type ChannelActivity = {
  channelId: string;
  channelName: string;
  messageCount: number;
};

export const mockDailyStats: DailyStats[] = [];

export const mockChannelActivity: ChannelActivity[] = [];
