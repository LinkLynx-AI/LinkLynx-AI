"use client";

import { useState } from "react";
import { useSendFriendRequest } from "@/services/mutations/use-friend-actions";
import { cn } from "@/lib/cn";

export function AddFriend() {
  const [username, setUsername] = useState("");
  const sendRequest = useSendFriendRequest();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    sendRequest.mutate(trimmed, {
      onSuccess: () => {
        setUsername("");
      },
    });
  };

  return (
    <div className="px-8 pt-5">
      <h2 className="text-base font-semibold uppercase text-discord-header-primary">
        フレンドに追加
      </h2>
      <p className="mt-1 text-sm text-discord-text-muted">
        ユーザー名を使ってフレンドに追加できます。
      </p>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "mt-4 flex items-center gap-4 rounded-lg border p-1.5 pl-4",
          sendRequest.isSuccess
            ? "border-discord-status-online"
            : sendRequest.isError
              ? "border-discord-status-dnd"
              : "border-discord-input-border bg-discord-bg-tertiary"
        )}
      >
        <input
          type="text"
          placeholder="ユーザー名を入力"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            sendRequest.reset();
          }}
          className="flex-1 bg-transparent text-sm text-discord-text-normal placeholder-discord-text-muted outline-none"
        />
        <button
          type="submit"
          disabled={!username.trim() || sendRequest.isPending}
          className={cn(
            "rounded px-4 py-1.5 text-sm font-medium text-white",
            "bg-discord-brand-blurple hover:bg-discord-brand-blurple-hover",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          フレンドリクエストを送信
        </button>
      </form>
      {sendRequest.isSuccess && (
        <p className="mt-2 text-sm text-discord-status-online" role="status">
          フレンドリクエストを送信しました。
        </p>
      )}
      {sendRequest.isError && (
        <p className="mt-2 text-sm text-discord-status-dnd" role="alert">
          {sendRequest.error instanceof Error
            ? sendRequest.error.message
            : "フレンドリクエストの送信に失敗しました。"}
        </p>
      )}
    </div>
  );
}
