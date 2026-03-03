"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const fieldLabels: Record<string, string> = {
  displayName: "表示名",
  username: "ユーザー名",
  email: "メールアドレス",
  phone: "電話番号",
};

export function UserAccountEditModal({
  field,
  currentValue,
  onSave,
  onClose,
}: {
  field: "displayName" | "username" | "email" | "phone";
  currentValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [password, setPassword] = useState("");
  const needsPassword = field === "email" || field === "phone";
  const label = fieldLabels[field];

  const canSave =
    newValue.trim().length > 0 && (!needsPassword || password.length > 0);

  const handleSave = () => {
    if (!canSave) return;
    onSave(newValue.trim());
  };

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>{label}を変更</ModalHeader>
      <ModalBody className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-discord-header-secondary">
            現在の{label}
          </p>
          <p className="text-sm text-discord-text-muted">{currentValue}</p>
        </div>

        <Input
          label={`新しい${label}`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
          fullWidth
          autoFocus
        />

        {needsPassword && (
          <div>
            <Input
              label="パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力してください"
              fullWidth
            />
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button variant="primary" disabled={!canSave} onClick={handleSave}>
          保存
        </Button>
      </ModalFooter>
    </Modal>
  );
}
