import type { Guild, GuildMember, Role } from "@/types/server";
import { mockUsers } from "./users";

export const mockServers: Guild[] = [
  {
    id: "200000000000000001",
    name: "開発チーム",
    icon: null,
    banner: null,
    ownerId: "100000000000000001",
    memberCount: 24,
    boostLevel: 1,
    boostCount: 3,
    features: ["COMMUNITY"],
    description: "プロジェクトの開発チームサーバー",
  },
  {
    id: "200000000000000002",
    name: "ゲーミングラウンジ",
    icon: null,
    banner: null,
    ownerId: "100000000000000003",
    memberCount: 156,
    boostLevel: 2,
    boostCount: 8,
    features: ["COMMUNITY", "INVITE_SPLASH"],
    description: "ゲーム好きが集まるサーバー",
  },
  {
    id: "200000000000000003",
    name: "音楽部",
    icon: null,
    banner: null,
    ownerId: "100000000000000004",
    memberCount: 42,
    boostLevel: 0,
    boostCount: 0,
    features: [],
    description: null,
  },
  {
    id: "200000000000000004",
    name: "デザインコミュニティ",
    icon: null,
    banner: null,
    ownerId: "100000000000000002",
    memberCount: 512,
    boostLevel: 3,
    boostCount: 15,
    features: ["COMMUNITY", "DISCOVERABLE", "BANNER"],
    description: "デザイナーのためのコミュニティ",
  },
];

export const mockRoles: Record<string, Role[]> = {
  "200000000000000001": [
    {
      id: "300000000000000001",
      name: "Admin",
      color: 0xe74c3c,
      position: 3,
      permissions: "8",
      mentionable: true,
      hoist: true,
      memberCount: 2,
    },
    {
      id: "300000000000000002",
      name: "Developer",
      color: 0x3498db,
      position: 2,
      permissions: "0",
      mentionable: true,
      hoist: true,
      memberCount: 8,
    },
    {
      id: "300000000000000003",
      name: "Member",
      color: 0x2ecc71,
      position: 1,
      permissions: "0",
      mentionable: false,
      hoist: false,
      memberCount: 14,
    },
  ],
};

export const mockMembers: Record<string, GuildMember[]> = {
  "200000000000000001": mockUsers
    .filter((u) => !u.bot || u.id === "100000000000000005")
    .map((user, i) => ({
      user,
      nick: null,
      roles:
        i === 0
          ? ["300000000000000001", "300000000000000002"]
          : i < 3
            ? ["300000000000000002"]
            : ["300000000000000003"],
      joinedAt: new Date(2024, 0, i + 1).toISOString(),
      avatar: null,
    })),
};
