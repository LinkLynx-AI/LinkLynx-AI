"use client";

import { useFriends } from "@/shared/api/legacy/queries/use-friends";
import { FriendItem } from "./friend-item";
import type { RelationshipType } from "@/shared/api/legacy/api-client";

const tabToType: Record<string, RelationshipType | "online"> = {
  オンライン: "online",
  全て: 1,
  ブロック中: 2,
};

export function FriendList({ activeTab }: { activeTab: string }) {
  const { data: relationships = [] } = useFriends();

  const filter = tabToType[activeTab];

  const filtered = relationships.filter((r) => {
    if (filter === "online") {
      return r.type === 1 && r.user.status !== "offline";
    }
    return r.type === filter;
  });

  const label =
    activeTab === "オンライン"
      ? `オンライン — ${filtered.length}`
      : activeTab === "全て"
        ? `全てのフレンド — ${filtered.length}`
        : `ブロック中 — ${filtered.length}`;

  return (
    <div className="flex-1 overflow-y-auto discord-scrollbar px-8 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase text-discord-channels-default">{label}</p>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-discord-text-muted">
          <p className="text-sm">
            {activeTab === "ブロック中"
              ? "ブロックしているユーザーはいません。"
              : "表示するフレンドがいません。"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {filtered.map((rel) => (
            <FriendItem key={rel.id} user={rel.user} />
          ))}
        </div>
      )}
    </div>
  );
}
