"use client";

import { type RefObject, useCallback, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  Link,
  Heading1,
  Quote,
  EyeOff,
  FileCode2,
  ListOrdered,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { HeadingDropdown } from "./heading-dropdown";
import { LinkPopover } from "./link-popover";

type FormattingToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (s: string) => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
};

type FormatButton = {
  icon: React.ElementType;
  label: string;
  prefix: string;
  suffix: string;
};

const FORMAT_BUTTONS: FormatButton[] = [
  { icon: Bold, label: "太字", prefix: "**", suffix: "**" },
  { icon: Italic, label: "斜体", prefix: "*", suffix: "*" },
  { icon: Underline, label: "下線", prefix: "__", suffix: "__" },
  { icon: Strikethrough, label: "取り消し線", prefix: "~~", suffix: "~~" },
  { icon: EyeOff, label: "スポイラー", prefix: "||", suffix: "||" },
  { icon: Code, label: "コード", prefix: "`", suffix: "`" },
  { icon: FileCode2, label: "コードブロック", prefix: "```\n", suffix: "\n```" },
  { icon: Quote, label: "引用", prefix: "> ", suffix: "" },
  { icon: List, label: "リスト", prefix: "- ", suffix: "" },
  { icon: ListOrdered, label: "番号リスト", prefix: "1. ", suffix: "" },
  { icon: Link, label: "リンク", prefix: "[", suffix: "](url)" },
];

export function FormattingToolbar({
  textareaRef,
  content,
  setContent,
  onTogglePreview,
  showPreview,
}: FormattingToolbarProps) {
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);

  const wrapSelection = useCallback(
    (prefix: string, suffix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.substring(start, end);

      const newContent =
        content.substring(0, start) + prefix + selected + suffix + content.substring(end);

      setContent(newContent);

      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = selected
          ? start + prefix.length + selected.length + suffix.length
          : start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [textareaRef, content, setContent],
  );

  const handleHeadingSelect = useCallback(
    (level: 1 | 2 | 3) => {
      const prefix = "#".repeat(level) + " ";
      wrapSelection(prefix, "");
    },
    [wrapSelection],
  );

  const handleLinkInsert = useCallback(
    (url: string, text: string) => {
      const displayText = text || url;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const linkMarkdown = `[${displayText}](${url})`;
      const newContent = content.substring(0, start) + linkMarkdown + content.substring(start);

      setContent(newContent);
      setShowLinkPopover(false);

      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = start + linkMarkdown.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [textareaRef, content, setContent],
  );

  const handleFormatClick = useCallback(
    (btn: FormatButton) => {
      if (btn.label === "リンク") {
        setShowLinkPopover((prev) => !prev);
        return;
      }
      wrapSelection(btn.prefix, btn.suffix);
    },
    [wrapSelection],
  );

  return (
    <div
      className="relative flex items-center gap-0.5 px-2 pt-1.5"
      role="toolbar"
      aria-label="テキスト書式"
    >
      {/* Heading dropdown button */}
      <div className="relative">
        <Tooltip content="見出し" position="top">
          <button
            type="button"
            aria-label="見出し"
            onClick={() => setShowHeadingDropdown((prev) => !prev)}
            className={cn(
              "rounded p-1 text-discord-interactive-normal",
              "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
              "transition-colors",
              showHeadingDropdown && "bg-discord-bg-mod-hover text-discord-interactive-hover",
            )}
          >
            <Heading1 className="h-4 w-4" />
          </button>
        </Tooltip>
        {showHeadingDropdown && (
          <HeadingDropdown
            onSelect={handleHeadingSelect}
            onClose={() => setShowHeadingDropdown(false)}
          />
        )}
      </div>

      {/* Separator */}
      <div className="mx-0.5 h-4 w-px bg-discord-bg-mod-faint" />

      {/* Format buttons */}
      {FORMAT_BUTTONS.map((btn) => (
        <div key={btn.label} className="relative">
          <Tooltip content={btn.label} position="top">
            <button
              type="button"
              aria-label={btn.label}
              onClick={() => handleFormatClick(btn)}
              className={cn(
                "rounded p-1 text-discord-interactive-normal",
                "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
                "transition-colors",
                btn.label === "リンク" &&
                  showLinkPopover &&
                  "bg-discord-bg-mod-hover text-discord-interactive-hover",
              )}
            >
              <btn.icon className="h-4 w-4" />
            </button>
          </Tooltip>
          {btn.label === "リンク" && showLinkPopover && (
            <LinkPopover onInsert={handleLinkInsert} onClose={() => setShowLinkPopover(false)} />
          )}
        </div>
      ))}

      {/* Separator */}
      <div className="mx-0.5 h-4 w-px bg-discord-bg-mod-faint" />

      {/* Preview toggle */}
      {onTogglePreview && (
        <Tooltip content={showPreview ? "プレビューを閉じる" : "プレビュー"} position="top">
          <button
            type="button"
            aria-label={showPreview ? "プレビューを閉じる" : "プレビュー"}
            onClick={onTogglePreview}
            className={cn(
              "rounded p-1 text-discord-interactive-normal",
              "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
              "transition-colors",
              showPreview && "bg-discord-bg-mod-hover text-discord-brand",
            )}
          >
            <Eye className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
