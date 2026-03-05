"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useCreateModerationReport,
  useReopenModerationReport,
  useResolveModerationReport,
} from "@/shared/api/mutations";
import { useModerationReports } from "@/shared/api/queries";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { buildModerationReportRoute } from "@/shared/config/routes";
import { ShellStatePlaceholder } from "@/widgets/app-shell";

export function ModerationQueuePage({ serverId }: { serverId: string }) {
  const { data: reports, isLoading, isError, error } = useModerationReports(serverId);
  const createReport = useCreateModerationReport();
  const resolveReport = useResolveModerationReport();
  const reopenReport = useReopenModerationReport();

  const [targetType, setTargetType] = useState<"message" | "user">("message");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    try {
      await createReport.mutateAsync({
        serverId,
        targetType,
        targetId,
        reason,
      });
      setReason("");
    } catch (caughtError) {
      setCreateError(toApiErrorText(caughtError, "通報の作成に失敗しました。"));
    }
  };

  const handleResolve = async (reportId: string) => {
    await resolveReport.mutateAsync({ serverId, reportId });
  };

  const handleReopen = async (reportId: string) => {
    await reopenReport.mutateAsync({ serverId, reportId });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <ShellStatePlaceholder
          state="loading"
          title="モデレーションキューを読み込み中です"
          description="通報データを取得しています。"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ShellStatePlaceholder
          state="error"
          title="モデレーションキューの取得に失敗しました"
          description={toApiErrorText(error, "時間をおいて再試行してください。")}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <section className="rounded border border-discord-divider bg-discord-bg-secondary p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-channels-default">
          通報作成
        </h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => void handleCreateReport(event)}
        >
          <label className="flex min-w-[140px] flex-col gap-1 text-xs text-discord-text-muted">
            対象種別
            <select
              className="rounded border border-discord-divider bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal"
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as "message" | "user")}
            >
              <option value="message">message</option>
              <option value="user">user</option>
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1 text-xs text-discord-text-muted">
            対象ID
            <input
              className="rounded border border-discord-divider bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              placeholder="例: 9001"
              required
            />
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-discord-text-muted">
            理由
            <input
              className="rounded border border-discord-divider bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="例: spam"
              required
            />
          </label>
          <button
            type="submit"
            disabled={createReport.isPending}
            className="rounded bg-discord-brand-green px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {createReport.isPending ? "作成中..." : "通報を作成"}
          </button>
        </form>
        {createError && <p className="mt-2 text-xs text-discord-brand-red">{createError}</p>}
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded border border-discord-divider bg-discord-bg-secondary">
        <header className="border-b border-discord-divider px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-discord-channels-default">
            通報キュー
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto discord-scrollbar">
          {(reports?.length ?? 0) === 0 ? (
            <div className="p-4 text-sm text-discord-text-muted">現在、通報はありません。</div>
          ) : (
            <ul className="divide-y divide-discord-divider">
              {reports?.map((report) => (
                <li key={report.reportId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={buildModerationReportRoute(serverId, report.reportId)}
                      className="text-sm font-medium text-discord-text-normal hover:underline"
                    >
                      Report #{report.reportId}
                    </Link>
                    <p className="mt-1 text-xs text-discord-text-muted">
                      {report.targetType}:{report.targetId} / {report.reason}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      report.status === "resolved"
                        ? "bg-discord-brand-green/20 text-discord-brand-green"
                        : "bg-discord-brand-yellow/20 text-discord-brand-yellow"
                    }`}
                  >
                    {report.status}
                  </span>
                  {report.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => void handleResolve(report.reportId)}
                      disabled={resolveReport.isPending}
                      className="rounded bg-discord-brand-green px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      resolve
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleReopen(report.reportId)}
                      disabled={reopenReport.isPending}
                      className="rounded bg-discord-brand-yellow px-2 py-1 text-xs font-medium text-black disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      reopen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
