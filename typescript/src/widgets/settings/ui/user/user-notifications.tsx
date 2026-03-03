"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Toggle } from "@/shared/ui/legacy/toggle";
import { Select } from "@/shared/ui/legacy/select";

const notificationOptions = [
  { value: "all", label: "すべてのメッセージ" },
  { value: "mentions", label: "メンションのみ" },
  { value: "nothing", label: "通知なし" },
];

type TTSMode = "all" | "mentions" | "disabled";

const mockServers = [
  { id: "1", name: "Discord開発サーバー", setting: "all" },
  { id: "2", name: "ゲームコミュニティ", setting: "mentions" },
  { id: "3", name: "勉強会グループ", setting: "nothing" },
];

export function UserNotifications() {
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);
  const [ttsMode, setTTSMode] = useState<TTSMode>("mentions");
  const [suppressEveryone, setSuppressEveryone] = useState(false);
  const [serverSettings, setServerSettings] = useState(mockServers);
  const [inlineReply, setInlineReply] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [sounds, setSounds] = useState({
    message: true,
    connect: true,
    disconnect: true,
    incoming: true,
    ptt: false,
    stream: true,
  });

  function handleSoundToggle(key: keyof typeof sounds) {
    setSounds((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleServerSettingChange(serverId: string, value: string) {
    setServerSettings((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, setting: value } : s)),
    );
  }

  return (
    <div className="pb-20">
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">通知</h2>

      {/* Desktop Notifications */}
      <section className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">デスクトップ通知</h3>
          <p className="text-xs text-discord-text-muted">デスクトップにプッシュ通知を表示します</p>
        </div>
        <Toggle checked={desktopNotifications} onChange={setDesktopNotifications} />
      </section>

      {/* Message Sounds */}
      <section className="mb-8 flex items-center justify-between border-b border-discord-divider pb-8">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">メッセージ通知音</h3>
          <p className="text-xs text-discord-text-muted">メッセージ受信時にサウンドを再生します</p>
        </div>
        <Toggle checked={messageSounds} onChange={setMessageSounds} />
      </section>

      {/* TTS */}
      <section className="mb-8 border-b border-discord-divider pb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          TTS (テキスト読み上げ)
        </h3>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="TTS設定">
          {[
            { id: "all" as const, label: "全てのメッセージ" },
            { id: "mentions" as const, label: "メンション時のみ" },
            { id: "disabled" as const, label: "無効" },
          ].map((opt) => (
            <button
              key={opt.id}
              role="radio"
              aria-checked={ttsMode === opt.id}
              onClick={() => setTTSMode(opt.id)}
              className="flex items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-discord-bg-mod-hover"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2",
                  ttsMode === opt.id
                    ? "border-discord-brand-blurple"
                    : "border-discord-interactive-normal",
                )}
              >
                {ttsMode === opt.id && (
                  <span className="h-2.5 w-2.5 rounded-full bg-discord-brand-blurple" />
                )}
              </span>
              <span className="text-sm text-discord-text-normal">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Suppress @everyone */}
      <section className="mb-8 flex items-center justify-between border-b border-discord-divider pb-8">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">@everyone / @here を抑制</h3>
          <p className="text-xs text-discord-text-muted">
            @everyone と @here のメンション通知を無効にします
          </p>
        </div>
        <Toggle checked={suppressEveryone} onChange={setSuppressEveryone} />
      </section>

      {/* Sound settings */}
      <section className="mb-8 border-b border-discord-divider pb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          サウンド設定
        </h3>
        <div className="flex flex-col gap-3">
          {[
            { key: "message" as const, label: "メッセージ通知音" },
            { key: "connect" as const, label: "接続音" },
            { key: "disconnect" as const, label: "切断音" },
            { key: "incoming" as const, label: "着信音" },
            { key: "ptt" as const, label: "PTT起動/停止音" },
            { key: "stream" as const, label: "ストリーム開始音" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-sm text-discord-text-normal">{item.label}</span>
              <Toggle checked={sounds[item.key]} onChange={() => handleSoundToggle(item.key)} />
            </div>
          ))}
        </div>
      </section>

      {/* Inline reply notifications */}
      <section className="mb-8 flex items-center justify-between border-b border-discord-divider pb-8">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">インラインリプライ通知</h3>
          <p className="text-xs text-discord-text-muted">リプライされた時に通知を受け取ります</p>
        </div>
        <Toggle checked={inlineReply} onChange={setInlineReply} />
      </section>

      {/* Focus mode */}
      <section className="mb-8 flex items-center justify-between border-b border-discord-divider pb-8">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">フォーカスモード</h3>
          <p className="text-xs text-discord-text-muted">
            有効にするとすべての通知を一時的に無効にします
          </p>
        </div>
        <Toggle checked={focusMode} onChange={setFocusMode} />
      </section>

      {/* Per-server notification settings */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          サーバーごとの通知設定
        </h3>
        <div className="flex flex-col gap-3">
          {serverSettings.map((server) => (
            <div
              key={server.id}
              className="flex items-center justify-between rounded-lg bg-discord-bg-secondary p-3"
            >
              <span className="text-sm font-medium text-discord-text-normal">{server.name}</span>
              <Select
                options={notificationOptions}
                value={server.setting}
                onChange={(v) => handleServerSettingChange(server.id, v)}
                className="w-48"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
