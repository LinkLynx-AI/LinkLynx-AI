"use client";

export function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;

  const text =
    users.length === 1
      ? `${users[0]} が入力中...`
      : users.length === 2
        ? `${users[0]} と ${users[1]} が入力中...`
        : `${users[0]}、${users[1]}、他${users.length - 2}人が入力中...`;

  return (
    <div className="flex items-center gap-1 px-4 pb-1 text-xs text-discord-text-muted">
      <span className="inline-flex gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-discord-text-muted [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-discord-text-muted [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-discord-text-muted [animation-delay:300ms]" />
      </span>
      <span>{text}</span>
    </div>
  );
}
