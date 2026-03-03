"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ExternalLinkModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [trustDomain, setTrustDomain] = useState(false);

  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  const handleOpen = () => {
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>外部サイトに移動</ModalHeader>
      <ModalBody>
        <p className="text-sm text-discord-text-normal mb-3">
          以下の外部リンクに移動しようとしています。注意してください。
        </p>
        <div className="rounded bg-discord-bg-secondary px-3 py-2 mb-3">
          <p className="text-sm text-discord-text-link break-all" data-testid="external-url">
            {url}
          </p>
        </div>
        <label className="flex items-center gap-2">
          <Checkbox checked={trustDomain} onChange={setTrustDomain} />
          <span className="text-sm text-discord-text-normal">
            {domain} を信頼する
          </span>
        </label>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button variant="primary" onClick={handleOpen}>
          開く
        </Button>
      </ModalFooter>
    </Modal>
  );
}
