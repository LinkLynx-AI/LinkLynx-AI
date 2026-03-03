"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinServerModal({ onClose }: { onClose: () => void }) {
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  const handleJoin = () => {
    if (!inviteLink.trim()) return;

    const isValid =
      inviteLink.startsWith("https://discord.gg/") || /^[a-zA-Z0-9]+$/.test(inviteLink.trim());

    if (!isValid) {
      setError("招待リンクが無効です。もう一度お試しください。");
      return;
    }

    setError("");
    onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>サーバーに参加</ModalHeader>
      <ModalBody>
        <Input
          label="招待リンク"
          placeholder="https://discord.gg/... または招待コード"
          value={inviteLink}
          onChange={(e) => {
            setInviteLink(e.target.value);
            if (error) setError("");
          }}
          error={error}
          fullWidth
        />
        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-discord-header-secondary">
            招待リンクの例
          </p>
          <div className="mt-1 space-y-0.5 text-sm text-discord-text-muted">
            <p>https://discord.gg/hTKzmak</p>
            <p>hTKzmak</p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button disabled={!inviteLink.trim()} onClick={handleJoin}>
          参加
        </Button>
      </ModalFooter>
    </Modal>
  );
}
