"use client";

import { useState, useMemo } from "react";
import { Plus, Grid3X3, List, Hash } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ForumPostCard } from "./forum-post-card";
import { ForumCreatePost } from "./forum-create-post";
import { MOCK_FORUM_POSTS, FORUM_TAGS } from "./forum-mock-data";

const SORT_OPTIONS = [
  { value: "lastActivity", label: "最新のアクティビティ" },
  { value: "createdAt", label: "作成日" },
];

export function ForumView({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [sortBy, setSortBy] = useState("lastActivity");
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  const filteredAndSortedPosts = useMemo(() => {
    let posts = [...MOCK_FORUM_POSTS];

    if (activeTagId) {
      posts = posts.filter((post) =>
        post.tags.some((tag) => tag.id === activeTagId)
      );
    }

    posts.sort((a, b) => {
      const dateA = sortBy === "lastActivity" ? a.lastActivityAt : a.createdAt;
      const dateB = sortBy === "lastActivity" ? b.lastActivityAt : b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return posts;
  }, [sortBy, activeTagId]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-discord-header-separator px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-discord-channel-icon" />
          <h1 className="font-semibold text-discord-header-primary">
            {channelName}
          </h1>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreatePost(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          新しい投稿を作成
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-discord-divider px-4 py-2">
        <Select
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={setSortBy}
          className="w-52"
        />

        <div className="flex items-center rounded-md bg-discord-bg-tertiary p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-discord-bg-mod-selected text-discord-interactive-active"
                : "text-discord-interactive-normal hover:text-discord-interactive-hover"
            )}
            aria-label="リスト表示"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            className={cn(
              "rounded p-1.5 transition-colors",
              viewMode === "gallery"
                ? "bg-discord-bg-mod-selected text-discord-interactive-active"
                : "text-discord-interactive-normal hover:text-discord-interactive-hover"
            )}
            aria-label="ギャラリー表示"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {FORUM_TAGS.map((tag) => (
            <button
              key={tag.id}
              onClick={() =>
                setActiveTagId((prev) => (prev === tag.id ? null : tag.id))
              }
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTagId === tag.id
                  ? "ring-2 ring-white/30"
                  : "opacity-60 hover:opacity-100"
              )}
              style={{
                backgroundColor: tag.color + "33",
                color: tag.color,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showCreatePost && (
          <div className="mb-4">
            <ForumCreatePost
              tags={FORUM_TAGS}
              onClose={() => setShowCreatePost(false)}
            />
          </div>
        )}

        {viewMode === "gallery" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedPosts.map((post) => (
              <ForumPostCard key={post.id} post={post} viewMode="gallery" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredAndSortedPosts.map((post) => (
              <ForumPostCard key={post.id} post={post} viewMode="list" />
            ))}
          </div>
        )}

        {filteredAndSortedPosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-discord-text-muted">
            <p className="text-lg font-medium">投稿が見つかりません</p>
            <p className="text-sm">フィルターを変更するか、新しい投稿を作成してください。</p>
          </div>
        )}
      </div>
    </div>
  );
}
