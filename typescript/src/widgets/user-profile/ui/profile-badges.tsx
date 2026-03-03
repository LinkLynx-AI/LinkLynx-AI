"use client";

import { Gem, Rocket, Code2, Bug, Sword, Sparkles, Scale, Heart, Terminal } from "lucide-react";
import type { UserBadge } from "@/shared/model/legacy/types/user";

const badgeConfig: Record<UserBadge, { icon: React.ElementType; label: string; color: string }> = {
  nitro: { icon: Gem, label: "Nitro", color: "text-[#f47fff]" },
  boost: { icon: Rocket, label: "Server Booster", color: "text-[#f47fff]" },
  developer: {
    icon: Code2,
    label: "Verified Bot Developer",
    color: "text-[#5865f2]",
  },
  bug_hunter: { icon: Bug, label: "Bug Hunter", color: "text-[#3ba55d]" },
  hypesquad_bravery: {
    icon: Sword,
    label: "HypeSquad Bravery",
    color: "text-[#9c84ef]",
  },
  hypesquad_brilliance: {
    icon: Sparkles,
    label: "HypeSquad Brilliance",
    color: "text-[#f47b68]",
  },
  hypesquad_balance: {
    icon: Scale,
    label: "HypeSquad Balance",
    color: "text-[#45ddc0]",
  },
  early_supporter: {
    icon: Heart,
    label: "Early Supporter",
    color: "text-[#7289da]",
  },
  active_developer: {
    icon: Terminal,
    label: "Active Developer",
    color: "text-[#23a55a]",
  },
};

export function ProfileBadges({ badges }: { badges: UserBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => {
        const config = badgeConfig[badge];
        const Icon = config.icon;
        return (
          <div
            key={badge}
            title={config.label}
            className="flex h-6 w-6 items-center justify-center rounded bg-discord-bg-tertiary"
          >
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
        );
      })}
    </div>
  );
}
