"use client";

import { useFriends } from "@/shared/api/queries/use-friends";
import { useAcceptFriendRequest, useRemoveFriend } from "@/shared/api/mutations/use-friend-actions";
import { Avatar } from "@/shared/ui/avatar";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function PendingRequests() {
  const { data: relationships = [] } = useFriends();
  const acceptMutation = useAcceptFriendRequest();
  const removeMutation = useRemoveFriend();

  const incoming = relationships.filter((r) => r.type === 3);
  const outgoing = relationships.filter((r) => r.type === 4);
  const total = incoming.length + outgoing.length;

  return (
    <div className="flex-1 overflow-y-auto discord-scrollbar px-8 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase text-discord-channels-default">
        保留中 — {total}
      </p>
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-discord-text-muted">
          <p className="text-sm">保留中のフレンドリクエストはありません。</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {incoming.map((rel) => (
            <div
              key={rel.id}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-discord-bg-mod-hover border-t border-discord-bg-mod-faint"
            >
              <Avatar
                src={rel.user.avatar ?? undefined}
                alt={rel.user.displayName}
                size={32}
                status={rel.user.status}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-discord-text-normal truncate">
                  {rel.user.displayName}
                </p>
                <p className="text-xs text-discord-text-muted">フレンドリクエストが届いています</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => acceptMutation.mutate(rel.user.id)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    "bg-discord-bg-secondary text-discord-status-online",
                    "hover:text-white",
                  )}
                  aria-label="承認"
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  onClick={() => removeMutation.mutate(rel.user.id)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    "bg-discord-bg-secondary text-discord-status-dnd",
                    "hover:text-white",
                  )}
                  aria-label="拒否"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          {outgoing.map((rel) => (
            <div
              key={rel.id}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-discord-bg-mod-hover border-t border-discord-bg-mod-faint"
            >
              <Avatar
                src={rel.user.avatar ?? undefined}
                alt={rel.user.displayName}
                size={32}
                status={rel.user.status}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-discord-text-normal truncate">
                  {rel.user.displayName}
                </p>
                <p className="text-xs text-discord-text-muted">フレンドリクエストを送信しました</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => removeMutation.mutate(rel.user.id)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    "bg-discord-bg-secondary text-discord-status-dnd",
                    "hover:text-white",
                  )}
                  aria-label="キャンセル"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
