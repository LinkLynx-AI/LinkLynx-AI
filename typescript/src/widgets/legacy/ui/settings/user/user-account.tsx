"use client";

import { useState } from "react";
import { Avatar } from "@/shared/ui/legacy/avatar";
import { Button } from "@/shared/ui/legacy/button";
import { useAuthStore } from "@/shared/model/legacy/stores/auth-store";
import { UserAccountEditModal } from "./user-account-edit-modal";
import { PasswordChangeForm } from "./password-change-form";
import { TwoFactorSetup } from "./two-factor-setup";

type EditField = "displayName" | "username" | "email" | "phone";

export function UserAccount() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const displayName = currentUser?.displayName ?? "User";
  const username = currentUser?.username ?? "user#0000";

  const [editField, setEditField] = useState<EditField | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [showDisableWarning, setShowDisableWarning] = useState(false);

  const fieldValues: Record<EditField, string> = {
    displayName,
    username,
    email: "u*****@example.com",
    phone: "***-****-**00",
  };

  const handleSave = (value: string) => {
    // In a real app, this would call an API
    void value;
    setEditField(null);
  };

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">マイアカウント</h2>

      {/* User card */}
      <div className="rounded-lg bg-discord-bg-secondary overflow-hidden">
        <div className="h-[100px] bg-discord-brand-blurple" />
        <div className="relative px-4 pb-4">
          <div className="-mt-10 mb-3">
            <Avatar
              src={currentUser?.avatar ?? undefined}
              alt={displayName}
              size={80}
              className="rounded-full border-[6px] border-discord-bg-secondary"
            />
          </div>

          <div className="rounded-lg bg-discord-bg-tertiary p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-discord-text-normal">表示名</p>
                <p className="text-sm text-discord-text-muted">{displayName}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditField("displayName")}>
                編集
              </Button>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-discord-text-normal">ユーザー名</p>
                <p className="text-sm text-discord-text-muted">{username}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditField("username")}>
                編集
              </Button>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-discord-text-normal">メールアドレス</p>
                <p className="text-sm text-discord-text-muted">u*****@example.com</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditField("email")}>
                編集
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-discord-text-normal">電話番号</p>
                <p className="text-sm text-discord-text-muted">***-****-**00</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditField("phone")}>
                編集
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="mt-8">
        <h3 className="mb-2 text-sm font-bold uppercase text-discord-header-secondary">
          パスワードと認証
        </h3>
        <Button variant="secondary" onClick={() => setShowPasswordChange(!showPasswordChange)}>
          パスワードを変更
        </Button>
        {showPasswordChange && (
          <PasswordChangeForm
            onSubmit={(current, newPw) => {
              void current;
              void newPw;
              setShowPasswordChange(false);
            }}
            onCancel={() => setShowPasswordChange(false)}
          />
        )}
      </div>

      {/* Two-Factor */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase text-discord-header-secondary">
          二要素認証
        </h3>
        <p className="mb-3 text-sm text-discord-text-muted">
          二要素認証でアカウントに追加のセキュリティレイヤーを設けましょう。
        </p>
        <Button variant="secondary" onClick={() => setShow2FA(!show2FA)}>
          二要素認証を有効にする
        </Button>
        {show2FA && (
          <TwoFactorSetup onComplete={() => setShow2FA(false)} onCancel={() => setShow2FA(false)} />
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-10 border-t border-discord-divider pt-6">
        <h3 className="mb-2 text-sm font-bold uppercase text-discord-header-secondary">
          アカウントの削除
        </h3>
        {showDisableWarning && (
          <div className="mb-3 rounded-lg bg-discord-bg-tertiary p-4">
            <p className="text-sm text-discord-brand-red">
              アカウントを無効にすると、サーバーへのアクセスやメッセージの送信ができなくなります。この操作は取り消すことができます。
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="danger" onClick={() => setShowDisableWarning(!showDisableWarning)}>
            アカウントを無効にする
          </Button>
          <Button variant="danger">アカウントを削除</Button>
        </div>
      </div>

      {/* Edit modal */}
      {editField && (
        <UserAccountEditModal
          field={editField}
          currentValue={fieldValues[editField]}
          onSave={handleSave}
          onClose={() => setEditField(null)}
        />
      )}
    </div>
  );
}
