"use client";

import { useEffect, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { useUpdateServer } from "@/shared/api/mutations/use-server-actions";
import { useServer } from "@/shared/api/queries/use-servers";
import { ServerDeleteModal } from "./server-delete-modal";

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
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
      setSaveSuccessMessage("サーバー名を保存しました。");
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
      <p className="mb-6 max-w-[560px] text-sm text-discord-text-muted">
        v1 のサーバー設定では、サーバー名の変更とサーバー削除のみが実APIへ接続されています。
      </p>

      <div className="mb-8 max-w-[480px]">
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
