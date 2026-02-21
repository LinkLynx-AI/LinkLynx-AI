"use client";

import { useState } from "react";
import { MemberAvatar } from "@/entities";
import { MessageComposer, ThemeToggleButton } from "@/features";
import { AppShellFrame } from "@/widgets";

const demoMember = {
  id: "member-1",
  displayName: "LinkLynx Bot",
  statusLabel: "Online",
  avatarLabel: "LB",
};

export default function Home() {
  const [composerValue, setComposerValue] = useState("");
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const canSubmit = composerValue.trim().length > 0;

  const handleComposerSubmit = () => {
    const trimmedValue = composerValue.trim();

    if (trimmedValue.length === 0) {
      return;
    }

    setLastSubmittedMessage(trimmedValue);
    setComposerValue("");
  };

  return (
    <AppShellFrame
      headerSlot={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-discord-primary">LinkLynx</h1>
          <ThemeToggleButton currentTheme="dark" disabled />
        </div>
      }
      sidebarSlot={
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Members
          </h2>
          <MemberAvatar member={demoMember} />
        </div>
      }
      contentSlot={
        <article className="space-y-6">
          <h2 className="text-xl font-semibold">FSD Public API Sandbox</h2>
          <p className="text-sm text-white/75">
            v1 UIスライスの雛形を Public API 経由で参照する構成を確認できます。
          </p>
          <section className="space-y-3 rounded-lg border border-white/10 bg-discord-dark/40 p-4">
            <h3 className="text-lg font-semibold text-white">Composer UI Demo</h3>
            <MessageComposer
              value={composerValue}
              canSubmit={canSubmit}
              onValueChange={setComposerValue}
              onSubmit={handleComposerSubmit}
            />
            <p className="text-xs text-white/70">
              直近の送信内容（UI only）: {lastSubmittedMessage ?? "未送信"}
            </p>
          </section>
        </article>
      }
    />
  );
}
