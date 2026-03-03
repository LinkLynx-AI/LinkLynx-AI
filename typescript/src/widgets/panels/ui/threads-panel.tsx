"use client";

import { useState } from "react";
import { ThreadCard, ThreadView, mockThreads } from "@/features/threads";
import type { ThreadData } from "@/features/threads";
import { EmptyState } from "@/shared/ui/empty-state";

export function ThreadsPanel() {
  const [selectedThread, setSelectedThread] = useState<ThreadData | null>(null);

  if (selectedThread) {
    return (
      <ThreadView
        threadId={selectedThread.id}
        threadName={selectedThread.name}
        memberCount={selectedThread.memberCount}
        onClose={() => setSelectedThread(null)}
      />
    );
  }

  if (mockThreads.length === 0) {
    return <EmptyState variant="no-threads" />;
  }

  return (
    <div className="space-y-1 p-3">
      {mockThreads.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} onSelect={setSelectedThread} />
      ))}
    </div>
  );
}
