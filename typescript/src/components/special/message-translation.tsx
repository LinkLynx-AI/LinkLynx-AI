"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { cn } from "@/lib/cn";

export function MessageTranslation({
  content,
  originalLanguage = "en",
}: {
  content: string;
  originalLanguage?: string;
}) {
  const [showTranslation, setShowTranslation] = useState(false);

  const translatedText = `${content}（翻訳済み）`;

  return (
    <div className="mt-1">
      <button
        onClick={() => setShowTranslation(!showTranslation)}
        className={cn(
          "inline-flex items-center gap-1 text-xs transition-colors",
          showTranslation
            ? "text-discord-brand-blurple"
            : "text-discord-text-muted hover:text-discord-text-normal",
        )}
      >
        <Languages className="h-3 w-3" />
        <span>{showTranslation ? "原文を表示" : "翻訳"}</span>
      </button>
      {showTranslation && (
        <p className="mt-1 rounded bg-discord-bg-secondary px-2 py-1 text-sm text-discord-text-normal">
          {translatedText}
        </p>
      )}
    </div>
  );
}
