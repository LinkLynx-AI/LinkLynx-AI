import { Hash } from "lucide-react";

export function WelcomeMessage({ channelName }: { channelName: string }) {
  return (
    <div className="px-4 pb-4 pt-8">
      <div className="mb-2 flex h-[68px] w-[68px] items-center justify-center rounded-full bg-discord-bg-accent">
        <Hash className="h-10 w-10 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-discord-header-primary">
        # {channelName} へようこそ！
      </h1>
      <p className="mt-1 text-discord-text-muted">ここが #{channelName} チャンネルの最初です。</p>
    </div>
  );
}
