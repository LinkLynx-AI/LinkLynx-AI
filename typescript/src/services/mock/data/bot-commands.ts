import type { SlashCommand } from "@/types/bot-components";

export const mockSlashCommands: SlashCommand[] = [
  {
    id: "cmd-001",
    name: "help",
    description: "ヘルプメニューを表示します",
    botName: "サポートBot",
    botAvatar: undefined,
    options: [],
  },
  {
    id: "cmd-002",
    name: "poll",
    description: "投票を作成します",
    botName: "サポートBot",
    botAvatar: undefined,
    options: [
      {
        name: "question",
        description: "投票の質問",
        type: "string",
        required: true,
      },
      {
        name: "options",
        description: "選択肢（カンマ区切り）",
        type: "string",
        required: true,
      },
    ],
  },
  {
    id: "cmd-003",
    name: "play",
    description: "音楽を再生します",
    botName: "音楽Bot",
    botAvatar: undefined,
    options: [
      {
        name: "query",
        description: "曲名またはURL",
        type: "string",
        required: true,
      },
    ],
  },
  {
    id: "cmd-004",
    name: "skip",
    description: "現在の曲をスキップします",
    botName: "音楽Bot",
    botAvatar: undefined,
    options: [],
  },
  {
    id: "cmd-005",
    name: "queue",
    description: "再生キューを表示します",
    botName: "音楽Bot",
    botAvatar: undefined,
    options: [],
  },
  {
    id: "cmd-006",
    name: "ban",
    description: "ユーザーをBANします",
    botName: "モデレーションBot",
    botAvatar: undefined,
    options: [
      {
        name: "user",
        description: "対象ユーザー",
        type: "user",
        required: true,
      },
      {
        name: "reason",
        description: "理由",
        type: "string",
        required: false,
      },
    ],
  },
  {
    id: "cmd-007",
    name: "warn",
    description: "ユーザーに警告を送信します",
    botName: "モデレーションBot",
    botAvatar: undefined,
    options: [
      {
        name: "user",
        description: "対象ユーザー",
        type: "user",
        required: true,
      },
      {
        name: "reason",
        description: "警告の理由",
        type: "string",
        required: true,
      },
    ],
  },
  {
    id: "cmd-008",
    name: "rank",
    description: "あなたのランクを表示します",
    botName: "レベルBot",
    botAvatar: undefined,
    options: [],
  },
];
