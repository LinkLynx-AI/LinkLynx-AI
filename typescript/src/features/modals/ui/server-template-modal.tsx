"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Hash, Volume2, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { cn } from "@/shared/lib/cn";

const mockChannelTree: {
  id: string;
  name: string;
  channels: { id: string; name: string; type: "text" | "voice" }[];
}[] = [];

export function ServerTemplateModal({ onClose }: { onClose: () => void; serverId?: string }) {
  const [view, setView] = useState<"create" | "preview">("create");
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(mockChannelTree.map((c) => c.id)),
  );

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Modal open onClose={onClose} className="max-w-[500px]">
      <ModalHeader>サーバーテンプレート</ModalHeader>

      {/* View toggle */}
      <div className="flex gap-1 px-4 pt-3">
        <button
          onClick={() => setView("create")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "create"
              ? "bg-discord-bg-mod-hover text-discord-text-normal"
              : "text-discord-text-muted hover:text-discord-text-normal",
          )}
        >
          テンプレートを作成
        </button>
        <button
          onClick={() => setView("preview")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            view === "preview"
              ? "bg-discord-bg-mod-hover text-discord-text-normal"
              : "text-discord-text-muted hover:text-discord-text-normal",
          )}
        >
          プレビュー
        </button>
      </div>

      {view === "create" ? (
        <>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
                  テンプレート名
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="テンプレート名を入力"
                  className="w-full rounded-md bg-discord-bg-tertiary px-3 py-2 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
                  説明
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="テンプレートの説明を入力"
                  rows={4}
                  className="w-full resize-none rounded-md bg-discord-bg-tertiary px-3 py-2 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-discord-text-normal hover:underline"
            >
              キャンセル
            </button>
            <button
              onClick={onClose}
              disabled={!templateName.trim()}
              className="rounded-md bg-discord-brand-blurple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-discord-brand-blurple/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              テンプレートを作成
            </button>
          </ModalFooter>
        </>
      ) : (
        <ModalBody>
          <div className="rounded-lg border border-discord-divider bg-discord-bg-secondary p-3">
            {mockChannelTree.map((category) => (
              <div key={category.id} className="mb-1">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center gap-1 px-1 py-1 text-xs font-bold uppercase text-discord-channel-default hover:text-discord-text-normal"
                >
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <FolderOpen className="mr-1 h-3 w-3" />
                  {category.name}
                </button>
                {expandedCategories.has(category.id) && (
                  <div className="ml-4 space-y-0.5">
                    {category.channels.map((channel) => (
                      <div
                        key={channel.id}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-discord-channel-default"
                      >
                        {channel.type === "voice" ? (
                          <Volume2 className="h-4 w-4 shrink-0" />
                        ) : (
                          <Hash className="h-4 w-4 shrink-0" />
                        )}
                        <span>{channel.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ModalBody>
      )}
    </Modal>
  );
}
