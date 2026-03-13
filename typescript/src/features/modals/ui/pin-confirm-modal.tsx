"use client";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
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
  const isNearLimit = currentPinCount >= 49 && currentPinCount < 50;
  const isAtLimit = currentPinCount >= 50;

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>
        {isPin ? "このメッセージをピン留めしますか？" : "このメッセージのピン留めを解除しますか？"}
      </ModalHeader>
      <ModalBody>
        <div className="rounded-md border border-discord-divider bg-discord-bg-secondary p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-discord-bg-mod-hover text-discord-header-primary">
              <Pin className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-discord-header-primary">
                ピン留め操作はまだ接続されていません
              </p>
              <p className="mt-1 text-sm leading-6 text-discord-text-muted">
                `LIN-917` では pin persistence の完了済み状態と未接続 UI を整理しています。
                {messageId ? ` 対象 message_id: ${messageId}` : ""}
              </p>
            </div>
          </div>
        </div>

        {isPin && (
          <p className="mt-3 text-sm text-discord-text-muted">
            一覧取得と pin/unpin 実行 API が未接続のため、この画面では状態確認のみを行います。
          </p>
        )}

        {isPin && !isAtLimit && isNearLimit && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-500/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <p className="text-sm text-yellow-500">ピン留めメッセージが上限(50)に近づいています</p>
          </div>
        )}

        {isPin && isAtLimit && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-500">ピン留めメッセージが上限に達しています</p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          閉じる
        </Button>
        <Button
          onClick={() => {
            onConfirm?.();
            onClose();
          }}
          disabled
          variant={isPin ? "primary" : "danger"}
        >
          {isPin ? "未接続" : "未接続"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
