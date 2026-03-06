"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Avatar } from "@/shared/ui/avatar";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { useUpdateServer } from "@/shared/api/mutations/use-server-actions";
import { useServer } from "@/shared/api/queries/use-servers";
import { Upload, Zap } from "lucide-react";
import { ServerDeleteModal } from "./server-delete-modal";

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

const SERVER_NAME_MAX_LENGTH = 100;

function validateServerName(value: string): string | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return "サーバー名を入力してください。";
  }
  if (normalized.length > SERVER_NAME_MAX_LENGTH) {
    return `サーバー名は${SERVER_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  return null;
}

export function ServerOverview({
  serverId,
  onDeleted,
}: {
  serverId: string;
  onDeleted?: () => void;
}) {
  const { data: server, isLoading, isError, error } = useServer(serverId);
  const updateServer = useUpdateServer();
  const [serverName, setServerName] = useState("");
  const [isNameDirty, setIsNameDirty] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [systemChannel, setSystemChannel] = useState("general");
  const [defaultNotifications, setDefaultNotifications] = useState("all");
  const [afkChannel, setAfkChannel] = useState("");
  const [afkTimeout, setAfkTimeout] = useState("300");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const nameValidationError = validateServerName(serverName);

  useEffect(() => {
    setIsNameDirty(false);
  }, [serverId]);

  useEffect(() => {
    if (server !== undefined && !isNameDirty) {
      setServerName(server.name);
    }
  }, [isNameDirty, server]);

  const handleSave = async () => {
    if (nameValidationError !== null) {
      setSaveSuccessMessage(null);
      return;
    }
    if (serverId.trim().length === 0) {
      setSubmitError("サーバーを選択してから再試行してください。");
      setSaveSuccessMessage(null);
      return;
    }

    setSubmitError(null);
    setSaveSuccessMessage(null);
    try {
      await updateServer.mutateAsync({
        serverId,
        data: {
          name: serverName.trim(),
        },
      });
      setServerName(serverName.trim());
      setIsNameDirty(false);
      setSaveSuccessMessage("サーバー設定を保存しました。");
    } catch (updateError: unknown) {
      setSubmitError(toApiErrorText(updateError, "サーバー設定の保存に失敗しました。"));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-discord-text-muted">サーバー設定を読み込み中です...</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-discord-brand-red">
        {toApiErrorText(error, "サーバー設定の読み込みに失敗しました。")}
      </p>
    );
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">サーバー概要</h2>

      {/* Banner Upload */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          サーバーバナー
        </label>
        <div className="flex h-[120px] w-full max-w-[480px] items-center justify-center rounded-lg border-2 border-dashed border-discord-interactive-muted bg-discord-bg-secondary cursor-pointer hover:border-discord-interactive-hover transition-colors">
          <div className="flex flex-col items-center gap-1 text-discord-interactive-muted">
            <Upload className="h-6 w-6" />
            <span className="text-xs">バナーをアップロード</span>
            <span className="text-[10px] text-discord-text-muted">推奨サイズ: 960x540px</span>
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
          <input ref={iconInputRef} type="file" accept="image/*" className="hidden" />
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
            onChange={(e) => {
              setServerName(e.target.value);
              setIsNameDirty(true);
              if (submitError !== null) {
                setSubmitError(null);
              }
              if (saveSuccessMessage !== null) {
                setSaveSuccessMessage(null);
              }
            }}
            error={nameValidationError ?? undefined}
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
          <span className="text-sm font-medium text-discord-text-normal">レベル 1</span>
          <span className="text-xs text-discord-text-muted">・ ブースト 2/7</span>
        </div>
      </div>

      <section className="mb-6 rounded-md border border-discord-btn-danger/30 bg-discord-btn-danger/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-discord-text-normal">サーバーを削除</h3>
            <p className="mt-1 text-xs text-discord-text-muted">
              削除するとサーバー一覧から消え、元に戻せません。
            </p>
          </div>
          <Button
            variant="danger"
            disabled={serverId.trim().length === 0}
            onClick={() => setDeleteModalOpen(true)}
          >
            サーバーを削除
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saveSuccessMessage !== null && (
          <p className="text-xs text-discord-status-online">{saveSuccessMessage}</p>
        )}
        {submitError !== null && <p className="text-xs text-discord-brand-red">{submitError}</p>}
        <Button
          onClick={() => void handleSave()}
          disabled={updateServer.isPending || nameValidationError !== null}
        >
          {updateServer.isPending ? "保存中..." : "変更を保存"}
        </Button>
      </div>
      {deleteModalOpen && (
        <ServerDeleteModal
          onClose={() => setDeleteModalOpen(false)}
          onDeleted={onDeleted}
          serverId={serverId}
          serverName={server?.name ?? serverName}
        />
      )}
    </div>
  );
}
