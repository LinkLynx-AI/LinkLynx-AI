"use client";

import { useState } from "react";
import { Modal } from "@/shared/ui/legacy/modal";
import { Avatar } from "@/shared/ui/legacy/avatar";
import { cn } from "@/shared/lib/legacy/cn";

type MockVoter = {
  id: string;
  displayName: string;
  avatar: string | null;
};

const mockPollOptions: { id: string; text: string; emoji?: string; votes: number }[] = [];

const mockVoters: Record<string, MockVoter[]> = {};

export function PollVotersModal({
  onClose,
}: {
  onClose: () => void;
  pollId?: string;
  optionId?: string;
}) {
  const [selectedOption, setSelectedOption] = useState<string>("");

  const voters = mockVoters[selectedOption] ?? [];

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <div className="flex h-[380px]">
        {/* Left: option tabs */}
        <div className="flex w-[150px] shrink-0 flex-col border-r border-discord-divider">
          {mockPollOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                selectedOption === option.id
                  ? "bg-discord-bg-mod-hover text-discord-text-normal"
                  : "text-discord-text-muted hover:bg-discord-bg-mod-hover hover:text-discord-text-normal",
              )}
            >
              {option.emoji && <span>{option.emoji}</span>}
              <span className="truncate">{option.text}</span>
              <span className="ml-auto shrink-0 text-xs text-discord-text-muted">
                {option.votes}
              </span>
            </button>
          ))}
        </div>

        {/* Right: voter list */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {voters.map((voter) => (
              <div
                key={voter.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-discord-bg-mod-hover"
              >
                <Avatar src={voter.avatar ?? undefined} alt={voter.displayName} size={32} />
                <span className="text-sm text-discord-text-normal">{voter.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
