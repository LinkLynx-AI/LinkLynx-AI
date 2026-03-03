"use client";

import { useMemo } from "react";
import { cn } from "@/shared/lib/legacy/cn";

type MarkdownPreviewProps = {
  content: string;
  visible: boolean;
};

function renderMarkdown(text: string): string {
  if (!text.trim()) return '<span class="text-discord-text-muted">プレビューなし</span>';

  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```)
  html = html.replace(
    /```([\s\S]*?)```/g,
    '<pre class="rounded bg-discord-bg-secondary p-2 text-sm font-mono my-1">$1</pre>',
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-discord-bg-secondary px-1 py-0.5 text-sm font-mono">$1</code>',
  );

  // Headings
  html = html.replace(/^### (.+)$/gm, '<div class="text-base font-semibold mt-2 mb-1">$1</div>');
  html = html.replace(/^## (.+)$/gm, '<div class="text-lg font-bold mt-2 mb-1">$1</div>');
  html = html.replace(/^# (.+)$/gm, '<div class="text-xl font-bold mt-2 mb-1">$1</div>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Underline
  html = html.replace(/__(.+?)__/g, '<span class="underline">$1</span>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Spoiler
  html = html.replace(
    /\|\|(.+?)\|\|/g,
    '<span class="rounded bg-discord-bg-secondary px-1">$1</span>',
  );

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="text-discord-text-link underline">$1</span>',
  );

  // Block quotes
  html = html.replace(
    /^&gt; (.+)$/gm,
    '<div class="border-l-4 border-discord-bg-mod-hover pl-3 py-0.5 text-discord-text-muted">$1</div>',
  );

  // Unordered list
  html = html.replace(/^- (.+)$/gm, '<div class="flex gap-2"><span>•</span><span>$1</span></div>');

  // Ordered list
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<div class="flex gap-2"><span>$1.</span><span>$2</span></div>',
  );

  // Newlines
  html = html.replace(/\n/g, "<br />");

  return html;
}

export function MarkdownPreview({ content, visible }: MarkdownPreviewProps) {
  const rendered = useMemo(() => renderMarkdown(content), [content]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "mx-2 mb-1 max-h-48 overflow-y-auto rounded-md",
        "border border-discord-bg-mod-faint bg-discord-bg-secondary p-3",
        "text-sm text-discord-text-normal",
      )}
    >
      <div dangerouslySetInnerHTML={{ __html: rendered }} className="break-words leading-relaxed" />
    </div>
  );
}
