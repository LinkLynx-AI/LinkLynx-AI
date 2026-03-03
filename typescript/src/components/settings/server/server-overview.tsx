"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Upload, Zap } from "lucide-react";

const notificationOptions = [
  { value: "all", label: "全てのメッセージ" },
  { value: "mentions", label: "@mentions のみ" },
];

const channelOptions = [
  { value: "general", label: "#general" },
  { value: "system", label: "#system" },
  { value: "welcome", label: "#welcome" },
];

const afkChannelOptions = [
  { value: "", label: "指定なし" },
  { value: "general", label: "#general" },
  { value: "afk", label: "#afk" },
  { value: "voice-lounge", label: "#voice-lounge" },
];

const afkTimeoutOptions = [
  { value: "60", label: "1分" },
  { value: "300", label: "5分" },
  { value: "900", label: "15分" },
  { value: "1800", label: "30分" },
  { value: "3600", label: "1時間" },
];

export function ServerOverview({ serverId }: { serverId: string }) {
  const [serverName, setServerName] = useState("My Server");
  const [description, setDescription] = useState("");
  const [systemChannel, setSystemChannel] = useState("general");
  const [defaultNotifications, setDefaultNotifications] = useState("all");
  const [afkChannel, setAfkChannel] = useState("");
  const [afkTimeout, setAfkTimeout] = useState("300");
  const iconInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">
        サーバー概要
      </h2>

      {/* Banner Upload */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          サーバーバナー
        </label>
        <div className="flex h-[120px] w-full max-w-[480px] items-center justify-center rounded-lg border-2 border-dashed border-discord-interactive-muted bg-discord-bg-secondary cursor-pointer hover:border-discord-interactive-hover transition-colors">
          <div className="flex flex-col items-center gap-1 text-discord-interactive-muted">
            <Upload className="h-6 w-6" />
            <span className="text-xs">バナーをアップロード</span>
            <span className="text-[10px] text-discord-text-muted">
              推奨サイズ: 960x540px
            </span>
          </div>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-6">
        <div className="relative">
          <button
            onClick={() => iconInputRef.current?.click()}
            className="group relative cursor-pointer"
          >
            <Avatar src={undefined} alt={serverName} size={80} />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="h-5 w-5 text-white" />
            </div>
          </button>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => iconInputRef.current?.click()}
          >
            アイコンを変更
          </Button>
        </div>
        <div className="flex-1">
          <Input
            label="サーバー名"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            fullWidth
          />
        </div>
      </div>

      <div className="mb-6">
        <Textarea
          label="サーバーの説明"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="サーバーについて説明してください"
          fullWidth
          rows={4}
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          システムメッセージチャンネル
        </label>
        <Select
          options={channelOptions}
          value={systemChannel}
          onChange={setSystemChannel}
          className="w-full max-w-[320px]"
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          デフォルトの通知設定
        </label>
        <Select
          options={notificationOptions}
          value={defaultNotifications}
          onChange={setDefaultNotifications}
          className="w-full max-w-[320px]"
        />
      </div>

      {/* AFK Settings */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          AFK チャンネル
        </label>
        <Select
          options={afkChannelOptions}
          value={afkChannel}
          onChange={setAfkChannel}
          className="w-full max-w-[320px]"
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          AFK タイムアウト
        </label>
        <Select
          options={afkTimeoutOptions}
          value={afkTimeout}
          onChange={setAfkTimeout}
          className="w-full max-w-[320px]"
        />
      </div>

      {/* Boost Level */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          サーバーブーストレベル
        </label>
        <div className="inline-flex items-center gap-2 rounded-full bg-discord-bg-secondary px-4 py-2">
          <Zap className="h-4 w-4 text-[#ff73fa]" />
          <span className="text-sm font-medium text-discord-text-normal">
            レベル 1
          </span>
          <span className="text-xs text-discord-text-muted">
            ・ ブースト 2/7
          </span>
        </div>
      </div>
    </div>
  );
}
