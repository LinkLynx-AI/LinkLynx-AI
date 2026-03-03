"use client";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";

export function DeleteConfirmModal({
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  onClose: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
}) {
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>{title ?? "本当に削除しますか？"}</ModalHeader>
      <ModalBody>
        <p className="text-sm text-discord-text-normal">
          {description ?? "この操作は取り消せません。"}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button variant="danger" onClick={handleConfirm}>
          {confirmLabel ?? "削除"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
