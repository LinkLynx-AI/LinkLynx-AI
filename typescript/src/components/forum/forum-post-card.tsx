"use client";

import { MessageSquare, Pin, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/format-date";
import type { ForumPost } from "./forum-types";

export function ForumPostCard({
  post,
  viewMode,
}: {
  post: ForumPost;
  viewMode: "list" | "gallery";
}) {
  if (viewMode === "gallery") {
    return (
      <div
        className={cn(
          "cursor-pointer rounded-lg bg-discord-bg-secondary p-4 transition-colors",
          "hover:bg-discord-bg-mod-hover"
        )}
      >
        {post.image && (
          <div className="mb-3 h-32 w-full overflow-hidden rounded-md bg-discord-bg-tertiary">
            <img
              src={post.image}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-1">
          {post.pinned && (
            <Pin className="h-3.5 w-3.5 text-discord-text-muted" />
          )}
          {post.locked && (
            <Lock className="h-3.5 w-3.5 text-discord-text-muted" />
          )}
          <h3 className="font-semibold text-discord-header-primary truncate">
            {post.title}
          </h3>
        </div>
        <p className="mb-3 text-sm text-discord-text-normal line-clamp-2">
          {post.content}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: tag.color + "33",
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-discord-text-muted">
          <Avatar
            src={post.author.avatar ?? undefined}
            alt={post.author.displayName}
            size={16}
          />
          <span>{post.author.displayName}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post.replyCount}
          </span>
          <span>{formatRelativeTime(post.lastActivityAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex cursor-pointer items-start gap-4 rounded-lg px-4 py-3 transition-colors",
        "hover:bg-discord-bg-mod-hover"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          {post.pinned && (
            <Pin className="h-3.5 w-3.5 shrink-0 text-discord-text-muted" />
          )}
          {post.locked && (
            <Lock className="h-3.5 w-3.5 shrink-0 text-discord-text-muted" />
          )}
          <h3 className="font-semibold text-discord-header-primary truncate">
            {post.title}
          </h3>
        </div>
        <p className="mb-2 text-sm text-discord-text-normal line-clamp-2">
          {post.content}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {post.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: tag.color + "33",
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-discord-text-muted">
          <Avatar
            src={post.author.avatar ?? undefined}
            alt={post.author.displayName}
            size={16}
          />
          <span>{post.author.displayName}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post.replyCount}
          </span>
          <span>{formatRelativeTime(post.lastActivityAt)}</span>
        </div>
      </div>
    </div>
  );
}
