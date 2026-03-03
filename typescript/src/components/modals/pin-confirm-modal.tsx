"use client";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AlertTriangle, Pin } from "lucide-react";

export function PinConfirmModal({
  onClose,
  messageId,
  action = "pin",
  currentPinCount = 0,
  onConfirm,
}: {
  onClose: () => void;
  messageId?: string;
  action?: "pin" | "unpin";
  currentPinCount?: number;
  onConfirm?: () => void;
}) {
  const isPin = action === "pin";
  const isNearLimit = currentPinCount >= 49;
  const isAtLimit = currentPinCount >= 50;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>
        {isPin
          ? "このメッセージをピン留めしますか？"
          : "このメッセージのピン留めを解除しますか？"}
      </ModalHeader>
      <ModalBody>
        {/* Message preview */}
        <div className="rounded-md bg-discord-bg-secondary p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-discord-brand-blurple text-xs font-bold text-white">
              U
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-discord-header-primary">
                  ユーザー
                </span>
                <span className="text-xs text-discord-text-muted">
                  今日 12:00
                </span>
              </div>
              <p className="mt-1 text-sm text-discord-text-normal">
                ピン留めされるメッセージのプレビュー
              </p>
            </div>
          </div>
        </div>

        {isPin && (
          <p className="mt-3 text-sm text-discord-text-muted">
            このメッセージをこのチャンネルにピン留めします。チャンネルのメンバー全員がピン留めされたメッセージを確認できます。
          </p>
        )}

        {isPin && !isAtLimit && isNearLimit && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-500/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <p className="text-sm text-yellow-500">
              ピン留めメッセージが上限(50)に近づいています
            </p>
          </div>
        )}

        {isPin && isAtLimit && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-500">
              ピン留めメッセージが上限に達しています
            </p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        {isPin ? (
          <Button onClick={handleConfirm} disabled={isAtLimit}>
            ピン留め
          </Button>
        ) : (
          <Button variant="danger" onClick={handleConfirm}>
            解除
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
