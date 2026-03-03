"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";

export function CodeBlock({ language, content }: { language: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-1 max-w-[90%] rounded bg-discord-bg-tertiary">
      {language && (
        <div className="flex items-center justify-between border-b border-discord-bg-accent/30 px-3 py-1">
          <span className="text-xs text-discord-text-muted">{language}</span>
          <button
            onClick={handleCopy}
            className={cn(
              "text-xs text-discord-text-muted hover:text-discord-text-normal",
              copied && "text-discord-brand-green",
            )}
          >
            {copied ? "コピーしました!" : "コピー"}
          </button>
        </div>
      )}
      {!language && (
        <button
          onClick={handleCopy}
          className={cn(
            "absolute right-2 top-2 text-xs text-discord-text-muted hover:text-discord-text-normal",
            copied && "text-discord-brand-green",
          )}
        >
          {copied ? "コピーしました!" : "コピー"}
        </button>
      )}
      <pre className="overflow-x-auto p-3">
        <code className="text-sm leading-[1.125rem] text-discord-header-secondary">{content}</code>
      </pre>
    </div>
  );
}
