"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/legacy/modal";
import { Button } from "@/shared/ui/legacy/button";

export function PublishButton({ onPublish }: { onPublish?: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePublish = () => {
    onPublish?.();
    setShowConfirm(false);
  };

  return (
    <>
      <button
        title="公開"
        onClick={() => setShowConfirm(true)}
        className={cn(
          "p-1.5 text-discord-interactive-normal",
          "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
          "rounded transition-colors",
        )}
      >
        <Megaphone className="h-4 w-4" />
      </button>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} className="max-w-[440px]">
        <ModalHeader>メッセージを公開</ModalHeader>
        <ModalBody>
          <p className="text-sm text-discord-text-normal">
            このメッセージをフォローしているすべてのサーバーに公開しますか？
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => setShowConfirm(false)}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handlePublish}>
            公開
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
