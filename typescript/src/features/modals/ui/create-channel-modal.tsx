"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Volume2, MessageSquare, Lock } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Toggle } from "@/shared/ui/toggle";
import { useCreateChannel } from "@/shared/api/mutations/use-channel-actions";
import { toCreateActionErrorText } from "@/shared/api/guild-channel-api-client";
import { buildChannelRoute } from "@/shared/config/routes";
import { cn } from "@/shared/lib/cn";

const TEXT_CHANNEL_TYPE = 0 as const;

const channelTypes = [
  {
    type: TEXT_CHANNEL_TYPE,
    label: "テキスト",
    icon: Hash,
    description: "メッセージや画像、GIFなどを送信できます",
    supported: true,
  },
  {
    type: 2 as const,
    label: "ボイス",
    icon: Volume2,
    description: "音声や画面共有ができます",
    supported: false,
  },
  {
    type: 15 as const,
    label: "フォーラム",
    icon: MessageSquare,
    description: "トピックごとに整理されたディスカッション",
    supported: false,
  },
];

export function CreateChannelModal({
  onClose,
  serverId,
}: {
  onClose: () => void;
  serverId?: string;
}) {
  const router = useRouter();
  const [channelType, setChannelType] = useState<0 | 2 | 15>(0);
  const [channelName, setChannelName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createChannel = useCreateChannel();
  const handleClose = () => {
    if (createChannel.isPending) {
      return;
    }
    onClose();
  };

  const handleCreate = async () => {
    if (serverId === undefined) {
      setSubmitError("サーバーを選択してから作成してください。");
      return;
    }

    const normalizedName = channelName.trim();
    if (normalizedName.length === 0) return;

    setSubmitError(null);
    try {
      const createdChannel = await createChannel.mutateAsync({
        serverId,
        data: { name: normalizedName, type: TEXT_CHANNEL_TYPE },
      });
      onClose();
      router.push(buildChannelRoute(serverId, createdChannel.id));
    } catch (error: unknown) {
      setSubmitError(toCreateActionErrorText(error, "チャンネルの作成に失敗しました。"));
    }
  };

  return (
    <Modal open onClose={handleClose} className="max-w-[460px]">
      <ModalHeader>チャンネルを作成</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
              チャンネルの種類
            </p>
            <p className="mb-2 text-xs text-discord-text-muted">
              v1ではテキストチャンネルのみ作成できます。
            </p>
            <div className="space-y-2">
              {channelTypes.map((ct) => {
                const Icon = ct.icon;
                const isDisabled = !ct.supported;
                return (
                  <button
                    key={ct.type}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) {
                        return;
                      }
                      setChannelType(ct.type);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-left transition-colors",
                      isDisabled && "cursor-not-allowed opacity-55",
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
            onChange={(e) => {
              setChannelName(e.target.value);
              if (submitError !== null) {
                setSubmitError(null);
              }
            }}
            error={submitError ?? undefined}
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
        <Button variant="link" onClick={handleClose}>
          キャンセル
        </Button>
        <Button
          disabled={!channelName.trim() || serverId === undefined || createChannel.isPending}
          onClick={() => void handleCreate()}
        >
          チャンネルを作成
        </Button>
      </ModalFooter>
    </Modal>
  );
}
