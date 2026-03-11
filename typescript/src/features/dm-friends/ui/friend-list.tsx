"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toApiErrorText } from "@/shared/api";
import { getAPIClient } from "@/shared/api/api-client";
import { useFriends } from "@/shared/api/queries/use-friends";
import { cn } from "@/shared/lib/cn";
import { FriendItem } from "./friend-item";
import type { RelationshipType } from "@/shared/api/api-client";

const tabToType: Record<string, RelationshipType | "online"> = {
  オンライン: "online",
  全て: 1,
  ブロック中: 2,
};

export function FriendList({ activeTab }: { activeTab: string }) {
  const router = useRouter();
  const { data: relationships = [] } = useFriends();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
            <FriendItem
              key={rel.id}
              user={rel.user}
              actions={
                <button
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    "bg-discord-bg-secondary text-discord-interactive-normal",
                    "hover:text-discord-interactive-hover disabled:opacity-60",
                  )}
                  aria-label="メッセージ"
                  type="button"
                  disabled={pendingUserId === rel.user.id}
                  onClick={() => {
                    setPendingUserId(rel.user.id);
                    setSubmitError(null);
                    void getAPIClient()
                      .createDM(rel.user.id)
                      .then((channel) => {
                        router.push(`/channels/me/${channel.id}`);
                      })
                      .catch((error: unknown) => {
                        setSubmitError(toApiErrorText(error, "DM の開始に失敗しました。"));
                      })
                      .finally(() => {
                        setPendingUserId((current) => (current === rel.user.id ? null : current));
                      });
                  }}
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              }
            />
          ))}
        </div>
      )}
      {submitError !== null && <p className="mt-3 text-xs text-discord-brand-red">{submitError}</p>}
    </div>
  );
}
