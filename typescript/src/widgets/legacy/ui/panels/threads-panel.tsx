"use client";

import { useState } from "react";
import { ThreadCard } from "@/widgets/legacy/ui/threads/thread-card";
import { ThreadView } from "@/widgets/legacy/ui/threads/thread-view";
import { mockThreads } from "@/widgets/legacy/ui/threads/thread-mock-data";
import type { ThreadData } from "@/widgets/legacy/ui/threads/thread-types";
import { EmptyState } from "@/shared/ui/legacy/empty-state";

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
