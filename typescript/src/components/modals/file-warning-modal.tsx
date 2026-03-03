"use client";

import { AlertTriangle } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function FileWarningModal({
  filename,
  onClose,
  onDownload,
}: {
  filename: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>ファイルのダウンロード確認</ModalHeader>
      <ModalBody>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 shrink-0 text-discord-status-warning" />
          <div>
            <p className="text-sm text-discord-text-normal mb-2">
              このファイルには実行可能なコードが含まれている可能性があります。
              信頼できるソースからのファイルのみダウンロードしてください。
            </p>
            <div className="rounded bg-discord-bg-secondary px-3 py-2">
              <p className="text-sm text-discord-text-normal font-medium break-all">{filename}</p>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button variant="danger" onClick={onDownload}>
          ダウンロード
        </Button>
      </ModalFooter>
    </Modal>
  );
}
