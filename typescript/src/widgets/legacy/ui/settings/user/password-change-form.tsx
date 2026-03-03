"use client";

import { useState } from "react";
import { Input } from "@/shared/ui/legacy/input";
import { Button } from "@/shared/ui/legacy/button";
import { PasswordStrengthIndicator } from "@/shared/ui/legacy/password-strength-indicator";

export function PasswordChangeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (current: string, newPassword: string) => void;
  onCancel: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordsMatch = newPassword === confirmPassword;
  const minLength = newPassword.length >= 8;
  const isValid =
    currentPassword.length > 0 && minLength && passwordsMatch && confirmPassword.length > 0;

  const confirmError =
    confirmPassword.length > 0 && !passwordsMatch ? "パスワードが一致しません" : undefined;

  const newPasswordError =
    newPassword.length > 0 && !minLength ? "8文字以上で入力してください" : undefined;

  return (
    <div className="mt-4 space-y-4 rounded-lg bg-discord-bg-tertiary p-4">
      <Input
        label="現在のパスワード"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        fullWidth
        autoFocus
      />

      <div>
        <Input
          label="新しいパスワード"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={newPasswordError}
          fullWidth
        />
        <PasswordStrengthIndicator password={newPassword} />
      </div>

      <Input
        label="パスワードの確認"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={confirmError}
        fullWidth
      />

      <div className="flex justify-end gap-2">
        <Button variant="link" onClick={onCancel}>
          キャンセル
        </Button>
        <Button
          variant="primary"
          disabled={!isValid}
          onClick={() => onSubmit(currentPassword, newPassword)}
        >
          変更
        </Button>
      </div>
    </div>
  );
}
