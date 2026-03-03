"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

interface MockVoter {
  id: string;
  displayName: string;
  avatar: string | null;
}

const mockPollOptions = [
  { id: "opt1", text: "オプション A", emoji: "🅰️", votes: 8 },
  { id: "opt2", text: "オプション B", emoji: "🅱️", votes: 5 },
  { id: "opt3", text: "オプション C", emoji: "🅲", votes: 3 },
];

const mockVoters: Record<string, MockVoter[]> = {
  opt1: [
    { id: "v1", displayName: "Tanaka Yuki", avatar: null },
    { id: "v2", displayName: "Sato Haruto", avatar: null },
    { id: "v3", displayName: "Yamada Aoi", avatar: null },
    { id: "v4", displayName: "Suzuki Ren", avatar: null },
    { id: "v5", displayName: "Takahashi Mei", avatar: null },
    { id: "v6", displayName: "Ito Sora", avatar: null },
    { id: "v7", displayName: "Watanabe Hina", avatar: null },
    { id: "v8", displayName: "Nakamura Riku", avatar: null },
  ],
  opt2: [
    { id: "v9", displayName: "Kobayashi Yua", avatar: null },
    { id: "v10", displayName: "Kato Haruki", avatar: null },
    { id: "v11", displayName: "Yoshida Sakura", avatar: null },
    { id: "v12", displayName: "Yamamoto Sota", avatar: null },
    { id: "v13", displayName: "Matsumoto Yuto", avatar: null },
  ],
  opt3: [
    { id: "v14", displayName: "Inoue Akari", avatar: null },
    { id: "v15", displayName: "Kimura Hinata", avatar: null },
    { id: "v16", displayName: "Hayashi Kaito", avatar: null },
  ],
};

export function PollVotersModal({
  onClose,
}: {
  onClose: () => void;
  pollId?: string;
  optionId?: string;
}) {
  const [selectedOption, setSelectedOption] = useState(mockPollOptions[0].id);

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
                  : "text-discord-text-muted hover:bg-discord-bg-mod-hover hover:text-discord-text-normal"
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
                <Avatar
                  src={voter.avatar ?? undefined}
                  alt={voter.displayName}
                  size={32}
                />
                <span className="text-sm text-discord-text-normal">
                  {voter.displayName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
