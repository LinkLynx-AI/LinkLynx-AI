"use client";

import { useState, useCallback, useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { CirclePlus, Smile, Sticker, Gift } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useSendMessage } from "@/shared/api/mutations/use-send-message";
import { EmojiPicker } from "@/widgets/pickers";
import { FormattingToolbar } from "./formatting-toolbar";
import { MarkdownPreview } from "./markdown-preview";
import { FileUploadArea, type FileItem } from "./file-upload-area";
import { SlashCommandPopup } from "../message/slash-command-popup";
import { mockSlashCommands } from "@/shared/api/mock/data/bot-commands";
import type { SlashCommand } from "@/shared/model/types/bot-components";

let fileIdCounter = 0;

function createFileItem(file: File): FileItem {
  const id = `file-${++fileIdCounter}-${Date.now()}`;
  const item: FileItem = {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
  };

  if (file.type.startsWith("image/")) {
    item.previewUrl = URL.createObjectURL(file);
  }

  return item;
}

export function MessageInput({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName: string;
}) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: sendMessage } = useSendMessage();

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    sendMessage({
      channelId,
      data: { content: trimmed },
    });
    setContent("");
    setPendingFiles([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, pendingFiles.length, channelId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }, []);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (newContent.startsWith("/")) {
      setShowSlashCommands(true);
      setSlashFilter(newContent.slice(1));
    } else {
      setShowSlashCommands(false);
      setSlashFilter("");
    }
  }, []);

  const handleSlashSelect = useCallback((command: SlashCommand) => {
    setContent(`/${command.name} `);
    setShowSlashCommands(false);
    setSlashFilter("");
    textareaRef.current?.focus();
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      const newItems = imageFiles.map(createFileItem);
      setPendingFiles((prev) => [...prev, ...newItems]);
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleToggleSpoiler = useCallback((index: number) => {
    setPendingFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, isSpoiler: !f.isSpoiler } : f)),
    );
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems = Array.from(files).map(createFileItem);
    setPendingFiles((prev) => [...prev, ...newItems]);

    // Reset input so the same file can be selected again
    e.target.value = "";
  }, []);

  const handleTogglePreview = useCallback(() => {
    setShowPreview((prev) => !prev);
  }, []);

  return (
    <div className="px-4 pb-6">
      <div className={cn("relative flex flex-col rounded-lg bg-discord-input-bg")}>
        {showSlashCommands && (
          <SlashCommandPopup
            commands={mockSlashCommands}
            filter={slashFilter}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashCommands(false)}
          />
        )}

        {/* File upload area */}
        {pendingFiles.length > 0 && (
          <FileUploadArea
            files={pendingFiles}
            onRemove={handleRemoveFile}
            onToggleSpoiler={handleToggleSpoiler}
          />
        )}

        <FormattingToolbar
          textareaRef={textareaRef}
          content={content}
          setContent={setContent}
          onTogglePreview={handleTogglePreview}
          showPreview={showPreview}
        />

        {/* Markdown preview */}
        <MarkdownPreview content={content} visible={showPreview} />

        <div className="flex items-end gap-0">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <button
            className={cn(
              "shrink-0 p-2.5",
              "text-discord-interactive-normal hover:text-discord-interactive-hover",
              "transition-colors",
            )}
            onClick={() => fileInputRef.current?.click()}
            type="button"
            aria-label="ファイルをアップロード"
          >
            <CirclePlus className="h-5 w-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              handleContentChange(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`#${channelName} にメッセージを送信`}
            rows={1}
            className={cn(
              "max-h-[300px] min-h-[24px] flex-1 resize-none",
              "bg-transparent py-2.5 text-base text-discord-text-normal",
              "placeholder:text-discord-text-muted",
              "outline-none",
            )}
          />

          <button
            className={cn(
              "shrink-0 p-2.5",
              "text-discord-interactive-normal hover:text-discord-interactive-hover",
              "transition-colors",
            )}
            title="GIF"
          >
            <Gift className="h-5 w-5" />
          </button>

          <button
            className={cn(
              "shrink-0 p-2.5",
              "text-discord-interactive-normal hover:text-discord-interactive-hover",
              "transition-colors",
            )}
            title="スタンプ"
          >
            <Sticker className="h-5 w-5" />
          </button>

          <div className="relative">
            <button
              ref={emojiButtonRef}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "shrink-0 p-2.5",
                "text-discord-interactive-normal hover:text-discord-interactive-hover",
                "transition-colors",
              )}
              title="絵文字"
            >
              <Smile className="h-5 w-5" />
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                mode="input"
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
