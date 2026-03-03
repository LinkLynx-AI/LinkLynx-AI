import type { PollData } from "./poll-types";

export const mockPolls: PollData[] = [
  {
    id: "poll-1",
    question: "次のミーティングはいつがいい？",
    options: [
      { id: "opt-1", text: "月曜日 10:00", votes: 5, voted: false, emoji: "📅" },
      { id: "opt-2", text: "火曜日 14:00", votes: 8, voted: true, emoji: "📅" },
      { id: "opt-3", text: "水曜日 11:00", votes: 3, voted: false, emoji: "📅" },
      { id: "opt-4", text: "木曜日 15:00", votes: 2, voted: false, emoji: "📅" },
    ],
    totalVotes: 18,
    expiresAt: "2024-01-20T00:00:00.000Z",
    expired: false,
    multiSelect: false,
  },
  {
    id: "poll-2",
    question: "好きなプログラミング言語は？（複数選択可）",
    options: [
      { id: "opt-5", text: "TypeScript", votes: 12, voted: true, emoji: "💙" },
      { id: "opt-6", text: "Python", votes: 9, voted: true, emoji: "🐍" },
      { id: "opt-7", text: "Rust", votes: 7, voted: false, emoji: "🦀" },
      { id: "opt-8", text: "Go", votes: 5, voted: false, emoji: "🐹" },
      { id: "opt-9", text: "Java", votes: 3, voted: false, emoji: "☕" },
    ],
    totalVotes: 36,
    expiresAt: null,
    expired: false,
    multiSelect: true,
  },
  {
    id: "poll-3",
    question: "チームランチの場所は？",
    options: [
      { id: "opt-10", text: "イタリアン", votes: 6, voted: false, emoji: "🍝" },
      { id: "opt-11", text: "和食", votes: 10, voted: true, emoji: "🍣" },
      { id: "opt-12", text: "中華", votes: 4, voted: false, emoji: "🥟" },
    ],
    totalVotes: 20,
    expiresAt: "2024-01-10T00:00:00.000Z",
    expired: true,
    multiSelect: false,
  },
];
