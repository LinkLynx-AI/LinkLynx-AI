export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalMembers: number;
  activeMembers: number;
  newMembers: number;
  messageCount: number;
}

export interface ChannelActivity {
  channelId: string;
  channelName: string;
  messageCount: number;
}

function generateDailyStats(): DailyStats[] {
  const stats: DailyStats[] = [];
  let totalMembers = 180;
  const baseDate = new Date("2026-01-30");

  for (let i = 0; i < 30; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const newMembers = Math.floor(Math.random() * 4);
    totalMembers += newMembers;
    const activeMembers = Math.floor(totalMembers * (0.3 + Math.random() * 0.25));
    const messageCount = Math.floor(80 + Math.random() * 200);

    stats.push({
      date: dateStr,
      totalMembers,
      activeMembers,
      newMembers,
      messageCount,
    });
  }

  return stats;
}

export const mockDailyStats: DailyStats[] = generateDailyStats();

export const mockChannelActivity: ChannelActivity[] = [
  { channelId: "ch-1", channelName: "general", messageCount: 1842 },
  { channelId: "ch-2", channelName: "雑談", messageCount: 1356 },
  { channelId: "ch-3", channelName: "ゲーム", messageCount: 987 },
  { channelId: "ch-4", channelName: "開発", messageCount: 743 },
  { channelId: "ch-5", channelName: "質問", messageCount: 521 },
  { channelId: "ch-6", channelName: "お知らせ", messageCount: 234 },
  { channelId: "ch-7", channelName: "音楽", messageCount: 189 },
  { channelId: "ch-8", channelName: "自己紹介", messageCount: 112 },
];
