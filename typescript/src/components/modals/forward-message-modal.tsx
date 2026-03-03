"use client";

import { useState, useMemo } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Hash } from "lucide-react";
import { useServers } from "@/services/queries/use-servers";
import { useDMChannels } from "@/services/queries/use-channels";
import type { Message } from "@/types/message";

interface ForwardDestination {
  id: string;
  type: "channel" | "dm";
  name: string;
  serverName?: string;
  avatar?: string | null;
}

export function ForwardMessageModal({
  onClose,
  message,
}: {
  onClose: () => void;
  message?: Message;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const { data: servers } = useServers();
  const { data: dmChannels } = useDMChannels();

  const destinations = useMemo<ForwardDestination[]>(() => {
    const items: ForwardDestination[] = [];

    // Add DM channels
    if (dmChannels) {
      for (const dm of dmChannels) {
        const recipient = dm.recipients?.[0];
        items.push({
          id: dm.id,
          type: "dm",
          name: recipient?.displayName ?? dm.name,
          avatar: recipient?.avatar ?? null,
        });
      }
    }

    // Add text channels from mock data (simplified)
    if (servers) {
      for (const server of servers) {
        items.push({
          id: `${server.id}-general`,
          type: "channel",
          name: "一般",
          serverName: server.name,
        });
      }
    }

    return items;
  }, [servers, dmChannels]);

  const filtered = useMemo(() => {
    if (!search) return destinations;
    const lower = search.toLowerCase();
    return destinations.filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        (d.serverName && d.serverName.toLowerCase().includes(lower))
    );
  }, [destinations, search]);

  const handleForward = () => {
    onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-[500px]">
      <ModalHeader>メッセージを転送</ModalHeader>

      <ModalBody className="space-y-4">
        {/* Search input */}
        <Input
          fullWidth
          placeholder="転送先を検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Destination list */}
        <div className="max-h-[200px] overflow-y-auto rounded bg-discord-bg-secondary p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-discord-text-muted">
              結果が見つかりませんでした
            </div>
          ) : (
            filtered.map((dest) => (
              <button
                key={dest.id}
                onClick={() => setSelectedId(dest.id)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === dest.id
                    ? "bg-discord-brand-blurple text-white"
                    : "text-discord-text-normal hover:bg-discord-bg-mod-hover"
                }`}
              >
                {dest.type === "channel" ? (
                  <Hash className="h-5 w-5 shrink-0 text-discord-channel-icon" />
                ) : (
                  <Avatar
                    src={dest.avatar ?? undefined}
                    alt={dest.name}
                    size={32}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{dest.name}</div>
                  {dest.serverName && (
                    <div className="truncate text-xs text-discord-text-muted">
                      {dest.serverName}
                    </div>
                  )}
                </div>
                <div
                  className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                    selectedId === dest.id
                      ? "border-white bg-white"
                      : "border-discord-interactive-normal"
                  }`}
                >
                  {selectedId === dest.id && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-full w-full text-discord-brand-blurple">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Message preview */}
        {message && (
          <div className="rounded border border-discord-divider bg-discord-bg-secondary p-3">
            <div className="mb-1 text-xs font-bold text-discord-header-secondary">
              転送するメッセージ
            </div>
            <div className="flex items-start gap-2">
              <Avatar
                src={message.author.avatar ?? undefined}
                alt={message.author.displayName}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-discord-header-primary">
                  {message.author.displayName}
                </div>
                <p className="text-sm text-discord-text-normal">
                  {message.content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comment input */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-discord-header-secondary">
            コメント（任意）
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="コメントを追加..."
            className="w-full resize-none rounded bg-discord-input-bg px-3 py-2 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple"
            rows={2}
          />
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          onClick={onClose}
          className="rounded px-4 py-2 text-sm font-medium text-discord-text-normal hover:underline"
        >
          キャンセル
        </button>
        <button
          onClick={handleForward}
          disabled={!selectedId}
          className="rounded bg-discord-brand-blurple px-4 py-2 text-sm font-medium text-white hover:bg-discord-brand-blurple/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          転送
        </button>
      </ModalFooter>
    </Modal>
  );
}
