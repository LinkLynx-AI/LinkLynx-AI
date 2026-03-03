"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { Button } from "@/shared/ui/legacy/button";
import { Input } from "@/shared/ui/legacy/input";
import { Textarea } from "@/shared/ui/legacy/textarea";
import type { ForumTag } from "./forum-types";

export function ForumCreatePost({ tags, onClose }: { tags: ForumTag[]; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  return (
    <div className="rounded-lg border border-discord-divider bg-discord-bg-secondary p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-discord-header-primary">新しい投稿を作成</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-discord-interactive-normal hover:text-discord-interactive-hover transition-colors"
          aria-label="閉じる"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-3">
        <Input
          placeholder="投稿のタイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
        />
      </div>

      <div className="mb-3">
        <div className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">タグ</div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedTags.includes(tag.id)
                  ? "ring-2 ring-white/30"
                  : "opacity-60 hover:opacity-100",
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

      <div className="mb-4">
        <Textarea
          placeholder="投稿内容を入力..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          fullWidth
          className="min-h-[100px]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          キャンセル
        </Button>
        <Button size="sm" disabled={!title.trim()}>
          投稿
        </Button>
      </div>
    </div>
  );
}
