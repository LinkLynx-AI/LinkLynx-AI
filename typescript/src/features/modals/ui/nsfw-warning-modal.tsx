"use client";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";

export function NsfwWarningModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>年齢制限チャンネル</ModalHeader>
      <ModalBody>
        <p className="text-sm text-discord-text-normal mb-2">
          このチャンネルにはNSFWコンテンツが含まれている可能性があります。
        </p>
        <p className="text-sm text-discord-text-muted">
          続行するには18歳以上である必要があります。
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          戻る
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          18歳以上です
        </Button>
      </ModalFooter>
    </Modal>
  );
}
