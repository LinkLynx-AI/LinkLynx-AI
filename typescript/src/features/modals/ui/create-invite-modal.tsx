"use client";

import { Button } from "@/shared/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

export function CreateInviteModal({ onClose }: { onClose: () => void; channelId?: string }) {
  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>招待を作成</ModalHeader>
      <ModalBody>
        <div className="space-y-3">
          <p className="text-sm text-discord-text-normal">招待の作成は現在一時停止しています。</p>
          <p className="text-xs text-discord-text-muted">
            invite API と権限制御の整備が完了するまで、この機能は利用できません。
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>閉じる</Button>
      </ModalFooter>
    </Modal>
  );
}
