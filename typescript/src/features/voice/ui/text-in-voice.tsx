"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Avatar } from "@/shared/ui/avatar";

type VoiceChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  content: string;
  timestamp: string;
};

const mockMessages: VoiceChatMessage[] = [];

export function TextInVoice({ channelName }: { channelId: string; channelName: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<VoiceChatMessage[]>(mockMessages);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage: VoiceChatMessage = {
      id: `vcm-${Date.now()}`,
      userId: "100000000000000001",
      displayName: "自分",
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-discord-divider bg-discord-bg-primary">
      {/* Header */}
      <div className="flex items-center border-b border-discord-divider px-3 py-2">
        <h3 className="text-sm font-semibold text-discord-header-primary">
          {channelName} - テキストチャット
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              <Avatar src={msg.avatar} alt={msg.displayName} size={16} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-medium text-discord-header-primary">
                    {msg.displayName}
                  </span>
                  <span className="text-[10px] text-discord-text-muted">{msg.timestamp}</span>
                </div>
                <p className="text-sm text-discord-text-normal">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-discord-divider p-2">
        <div className="flex items-center gap-2 rounded-md bg-discord-bg-secondary px-3 py-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを送信"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-discord-text-normal placeholder:text-discord-text-muted focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-discord-interactive-normal transition-colors hover:text-discord-interactive-hover disabled:opacity-40"
            aria-label="送信"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
