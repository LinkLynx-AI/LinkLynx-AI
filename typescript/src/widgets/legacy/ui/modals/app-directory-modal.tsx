"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Modal } from "@/shared/ui/legacy/modal";
import { cn } from "@/shared/lib/legacy/cn";

type AppInfo = {
  id: string;
  name: string;
  description: string;
  color: string;
  category: string;
};

const mockApps: AppInfo[] = [
  {
    id: "1",
    name: "MEE6",
    description: "レベリング、モデレーション、カスタムコマンド",
    color: "#7289da",
    category: "人気",
  },
  {
    id: "2",
    name: "Dyno",
    description: "高機能モデレーションとカスタムコマンド",
    color: "#f04747",
    category: "人気",
  },
  {
    id: "3",
    name: "Carl-bot",
    description: "リアクションロール、ログ、自動モデレーション",
    color: "#ff9b00",
    category: "モデレーション",
  },
  {
    id: "4",
    name: "ProBot",
    description: "ウェルカム画像、レベリング、保護",
    color: "#ff73fa",
    category: "人気",
  },
  {
    id: "5",
    name: "YAGPDB",
    description: "汎用ボットでカスタムコマンドに対応",
    color: "#43b581",
    category: "ユーティリティ",
  },
  {
    id: "6",
    name: "Arcane",
    description: "レベリングとリーダーボード",
    color: "#7c3aed",
    category: "ゲーム",
  },
  {
    id: "7",
    name: "Dank Memer",
    description: "ミームコマンドとカレンシーゲーム",
    color: "#4ade80",
    category: "ゲーム",
  },
  {
    id: "8",
    name: "AutoMod+",
    description: "高度な自動モデレーション設定",
    color: "#ef4444",
    category: "モデレーション",
  },
  {
    id: "9",
    name: "MusicBot",
    description: "高品質な音楽再生ボット",
    color: "#3b82f6",
    category: "新着",
  },
];

const categories = ["すべて", "人気", "新着", "ゲーム", "モデレーション", "ユーティリティ"];

export function AppDirectoryModal({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("すべて");

  const filteredApps = mockApps.filter((app) => {
    const matchesSearch =
      searchQuery === "" ||
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "すべて" || app.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Modal open onClose={onClose} className="max-w-3xl">
      <div className="flex flex-col" style={{ height: "80vh", maxHeight: 600 }}>
        {/* Header */}
        <div className="border-b border-discord-divider px-6 pt-6 pb-4">
          <h2 className="mb-4 text-xl font-bold text-discord-header-primary">App Directory</h2>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-discord-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="アプリを検索..."
              className="w-full rounded-md bg-discord-bg-tertiary py-2 pl-9 pr-8 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-discord-text-muted hover:text-discord-text-normal"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-discord-brand-blurple text-white"
                    : "bg-discord-bg-secondary text-discord-text-muted hover:bg-discord-bg-mod-hover hover:text-discord-text-normal",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* App grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredApps.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-discord-text-muted">アプリが見つかりませんでした</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="rounded-lg border border-discord-divider bg-discord-bg-secondary p-4 transition-colors hover:bg-discord-bg-mod-hover"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: app.color }}
                    >
                      {app.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-discord-header-primary">
                        {app.name}
                      </div>
                    </div>
                  </div>
                  <p className="mb-3 line-clamp-2 text-xs text-discord-text-muted">
                    {app.description}
                  </p>
                  <button className="w-full rounded-md bg-discord-brand-blurple px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-discord-brand-blurple/80">
                    追加
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
