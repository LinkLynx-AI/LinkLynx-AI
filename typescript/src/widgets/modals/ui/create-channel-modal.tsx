"use client";

import { useState } from "react";
import { Hash, Volume2, MessageSquare, Lock } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/legacy/modal";
import { Button } from "@/shared/ui/legacy/button";
import { Input } from "@/shared/ui/legacy/input";
import { Toggle } from "@/shared/ui/legacy/toggle";
import { useCreateChannel } from "@/shared/api/legacy/mutations/use-channel-actions";
import { cn } from "@/shared/lib/legacy/cn";

const channelTypes = [
  {
    type: 0 as const,
    label: "テキスト",
    icon: Hash,
    description: "メッセージや画像、GIFなどを送信できます",
  },
  { type: 2 as const, label: "ボイス", icon: Volume2, description: "音声や画面共有ができます" },
  {
    type: 15 as const,
    label: "フォーラム",
    icon: MessageSquare,
    description: "トピックごとに整理されたディスカッション",
  },
];

export function CreateChannelModal({
  onClose,
  serverId,
}: {
  onClose: () => void;
  serverId?: string;
}) {
  const [channelType, setChannelType] = useState<0 | 2 | 15>(0);
  const [channelName, setChannelName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const createChannel = useCreateChannel();

  const handleCreate = () => {
    if (!channelName.trim() || !serverId) return;
    createChannel.mutate(
      { serverId, data: { name: channelName.trim(), type: channelType } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal open onClose={onClose} className="max-w-[460px]">
      <ModalHeader>チャンネルを作成</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
              チャンネルの種類
            </p>
            <div className="space-y-2">
              {channelTypes.map((ct) => {
                const Icon = ct.icon;
                return (
                  <button
                    key={ct.type}
                    onClick={() => setChannelType(ct.type)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-left transition-colors",
                      channelType === ct.type
                        ? "bg-discord-bg-mod-selected"
                        : "bg-discord-bg-secondary hover:bg-discord-bg-mod-hover",
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-bg-tertiary">
                      <Icon className="h-5 w-5 text-discord-interactive-normal" />
                    </div>
                    <div>
                      <div className="font-medium text-discord-text-normal">{ct.label}</div>
                      <div className="text-xs text-discord-text-muted">{ct.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <Input
            label="チャンネル名"
            placeholder="新しいチャンネル"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            fullWidth
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-discord-interactive-normal" />
              <div>
                <div className="text-sm font-medium text-discord-text-normal">
                  プライベートチャンネル
                </div>
                <div className="text-xs text-discord-text-muted">
                  選択したメンバーとロールのみがこのチャンネルを見ることができます
                </div>
              </div>
            </div>
            <Toggle checked={isPrivate} onChange={setIsPrivate} />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button disabled={!channelName.trim()} onClick={handleCreate}>
          チャンネルを作成
        </Button>
      </ModalFooter>
    </Modal>
  );
}
