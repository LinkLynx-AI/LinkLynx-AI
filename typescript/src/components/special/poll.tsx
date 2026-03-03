"use client";

import { useState } from "react";
import { Check, BarChart3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUIStore } from "@/stores/ui-store";
import type { PollData } from "./poll-types";

export function Poll({ poll }: { poll: PollData }) {
  const [showResults, setShowResults] = useState(poll.expired);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(
    poll.options.find((o) => o.voted)?.id ?? null
  );
  const [ended, setEnded] = useState(poll.expired);
  const openModal = useUIStore((s) => s.openModal);

  return (
    <div className="my-2 max-w-md rounded-lg border border-discord-divider bg-discord-bg-secondary p-4">
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-discord-brand-blurple" />
        <h3 className="text-lg font-semibold text-discord-header-primary">
          {poll.question}
        </h3>
      </div>

      {(poll.expired || ended) && (
        <p className="mt-2 text-sm text-discord-text-muted">
          この投票は終了しました
        </p>
      )}

      <div className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const percentage =
            poll.totalVotes > 0
              ? Math.round((option.votes / poll.totalVotes) * 100)
              : 0;

          return (
            <div key={option.id} className="relative">
              <div
                className={cn(
                  "relative z-10 flex items-center justify-between rounded-md px-3 py-2",
                  !poll.expired && !showResults && "hover:bg-discord-bg-mod-hover cursor-pointer"
                )}
              >
                <div className="flex items-center gap-2">
                  {option.emoji && (
                    <span className="text-base">{option.emoji}</span>
                  )}
                  <span className="text-sm text-discord-text-normal">
                    {option.text}
                  </span>
                  {option.voted && (
                    <Check className="h-4 w-4 text-discord-brand-blurple" />
                  )}
                </div>
                {(showResults || poll.expired || ended) && (
                  <span
                    className="cursor-pointer text-sm font-medium text-discord-text-muted hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal("poll-voters", {
                        pollId: poll.id,
                        optionId: option.id,
                      });
                    }}
                  >
                    {option.votes} ({percentage}%)
                  </span>
                )}
              </div>
              {(showResults || poll.expired || ended) && (
                <div className="absolute inset-0 overflow-hidden rounded-md">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      option.id === votedOptionId
                        ? "bg-discord-brand-blurple/20"
                        : "bg-discord-bg-tertiary"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-discord-text-muted">
          {poll.totalVotes} 票
        </span>
        {!poll.expired && !ended && (
          <>
            <button
              onClick={() => setShowResults(!showResults)}
              className="text-xs font-medium text-discord-brand-blurple hover:underline"
            >
              {showResults ? "投票する" : "結果を見る"}
            </button>
            {votedOptionId && (
              <button
                onClick={() => {
                  setVotedOptionId(null);
                  setShowResults(false);
                }}
                className="text-xs font-medium text-discord-text-muted hover:text-discord-text-normal hover:underline"
              >
                投票を取り消す
              </button>
            )}
            <button
              onClick={() => {
                setEnded(true);
                setShowResults(true);
              }}
              className="text-xs font-medium text-discord-status-dnd hover:underline"
            >
              投票を終了
            </button>
          </>
        )}
      </div>
    </div>
  );
}
