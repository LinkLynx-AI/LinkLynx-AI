"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useCreateModerationMute,
  useReopenModerationReport,
  useResolveModerationReport,
} from "@/shared/api/mutations";
import { useModerationReport } from "@/shared/api/queries";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { buildModerationQueueRoute } from "@/shared/config/routes";
import { ModerationStatePlaceholder } from "./moderation-state-placeholder";

export function ModerationReportDetailPage({
  serverId,
  reportId,
}: {
  serverId: string;
  reportId: string;
}) {
  const { data: report, isLoading, isError, error } = useModerationReport(serverId, reportId);
  const resolveReport = useResolveModerationReport();
  const reopenReport = useReopenModerationReport();
  const createMute = useCreateModerationMute();

  const [muteTargetUserId, setMuteTargetUserId] = useState("");
  const [muteReason, setMuteReason] = useState("moderation action");
  const [muteExpiresAt, setMuteExpiresAt] = useState("");
  const [muteResult, setMuteResult] = useState<string | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-6">
        <ModerationStatePlaceholder
          title="通報詳細を読み込み中です"
          description="対象通報の状態を確認しています。"
        />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="p-6">
        <ModerationStatePlaceholder
          title="通報詳細の取得に失敗しました"
          description={toApiErrorText(error, "対象の通報が見つかりません。")}
        />
      </div>
    );
  }

  const defaultMuteTarget = report.targetType === "user" ? report.targetId : "";
  const effectiveMuteTargetUserId =
    muteTargetUserId.trim().length > 0 ? muteTargetUserId.trim() : defaultMuteTarget;

  const handleResolve = async () => {
    await resolveReport.mutateAsync({
      serverId,
      reportId: report.reportId,
    });
  };

  const handleReopen = async () => {
    await reopenReport.mutateAsync({
      serverId,
      reportId: report.reportId,
    });
  };

  const handleCreateMute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMuteError(null);
    setMuteResult(null);

    try {
      const created = await createMute.mutateAsync({
        serverId,
        targetUserId: effectiveMuteTargetUserId,
        reason: muteReason,
        expiresAt: muteExpiresAt.trim().length > 0 ? muteExpiresAt.trim() : null,
      });
      setMuteResult(`mute_id=${created.muteId}`);
    } catch (caughtError) {
      setMuteError(toApiErrorText(caughtError, "ミュート作成に失敗しました。"));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-discord-text-normal">
          Report #{report.reportId}
        </h1>
        <Link
          href={buildModerationQueueRoute(serverId)}
          className="text-xs text-discord-text-link hover:underline"
        >
          キューへ戻る
        </Link>
      </div>

      <section className="rounded border border-discord-divider bg-discord-bg-secondary p-4">
        <dl className="grid grid-cols-1 gap-2 text-sm text-discord-text-normal">
          <div>
            <dt className="text-xs text-discord-text-muted">status</dt>
            <dd>{report.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-discord-text-muted">target</dt>
            <dd>
              {report.targetType}:{report.targetId}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-discord-text-muted">reason</dt>
            <dd>{report.reason}</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center gap-2">
          {report.status === "open" ? (
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={resolveReport.isPending}
              className="rounded bg-discord-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resolveReport.isPending ? "処理中..." : "resolve"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleReopen()}
              disabled={reopenReport.isPending}
              className="rounded bg-discord-brand-yellow px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              {reopenReport.isPending ? "処理中..." : "reopen"}
            </button>
          )}
        </div>
      </section>

      <section className="rounded border border-discord-divider bg-discord-bg-secondary p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-channels-default">
          ミュート操作
        </h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => void handleCreateMute(event)}
        >
          <label className="flex min-w-[180px] flex-col gap-1 text-xs text-discord-text-muted">
            対象ユーザーID
            <input
              className="rounded border border-discord-divider bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal"
              value={muteTargetUserId}
              onChange={(event) => setMuteTargetUserId(event.target.value)}
              placeholder={defaultMuteTarget || "ユーザーIDを入力"}
              required={defaultMuteTarget.length === 0}
            />
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-discord-text-muted">
            理由
            <input
              className="rounded border border-discord-divider bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal"
              value={muteReason}
              onChange={(event) => setMuteReason(event.target.value)}
              required
            />
          </label>
          <label className="flex min-w-[220px] flex-col gap-1 text-xs text-discord-text-muted">
            期限（任意）
            <input
              className="rounded border border-discord-divider bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal"
              value={muteExpiresAt}
              onChange={(event) => setMuteExpiresAt(event.target.value)}
              placeholder="2026-04-01T00:00:00Z"
            />
          </label>
          <button
            type="submit"
            disabled={createMute.isPending}
            className="rounded bg-discord-brand-red px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {createMute.isPending ? "処理中..." : "mute"}
          </button>
        </form>

        {muteResult && <p className="mt-2 text-xs text-discord-brand-green">{muteResult}</p>}
        {muteError && <p className="mt-2 text-xs text-discord-brand-red">{muteError}</p>}
      </section>
    </div>
  );
}
