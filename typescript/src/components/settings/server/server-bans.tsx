"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface BannedUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  reason: string;
}

const initialBans: BannedUser[] = [
  { id: "ban-1", username: "spammer42", displayName: "Spammer", avatar: null, reason: "スパム行為" },
  { id: "ban-2", username: "troll_king", displayName: "Troll King", avatar: null, reason: "荒らし行為" },
  { id: "ban-3", username: "hacker_x", displayName: "HackerX", avatar: null, reason: "不正アクセスの試行" },
  { id: "ban-4", username: "toxic_user", displayName: "Toxic", avatar: null, reason: "他メンバーへの嫌がらせ" },
  { id: "ban-5", username: "scam_bot", displayName: "ScamBot", avatar: null, reason: "詐欺リンクの投稿" },
];

export function ServerBans({ serverId }: { serverId: string }) {
  const [bans, setBans] = useState<BannedUser[]>(initialBans);
  const [search, setSearch] = useState("");

  const filtered = bans.filter((ban) => {
    const q = search.toLowerCase();
    return (
      ban.username.toLowerCase().includes(q) ||
      ban.displayName.toLowerCase().includes(q)
    );
  });

  function unban(userId: string) {
    setBans((prev) => prev.filter((b) => b.id !== userId));
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">
        BAN
      </h2>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-discord-text-muted"
        />
        <input
          type="text"
          placeholder="BANされたユーザーを検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-[3px] bg-discord-input-bg pl-9 pr-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple"
        />
      </div>

      <div className="text-sm text-discord-text-muted mb-3">
        BAN — {filtered.length}
      </div>

      <div>
        {filtered.map((ban) => (
          <div
            key={ban.id}
            className="group flex items-center gap-3 rounded px-3 py-2.5 hover:bg-discord-bg-mod-hover transition-colors"
          >
            <Avatar
              src={ban.avatar ?? undefined}
              alt={ban.displayName}
              size={40}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-discord-text-normal">
                  {ban.displayName}
                </span>
                <span className="truncate text-xs text-discord-text-muted">
                  {ban.username}
                </span>
              </div>
              <p className="text-xs text-discord-text-muted mt-0.5">
                理由: {ban.reason}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => unban(ban.id)}
            >
              BAN解除
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-discord-text-muted">
              {search ? "一致するユーザーが見つかりません" : "BANされたユーザーはいません"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
