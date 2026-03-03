import { cn } from "@/lib/cn";
import { AlertCircle, RotateCcw, Trash2 } from "lucide-react";

export function ErrorMessage({
  content,
  onRetry,
  onDelete,
  className,
}: {
  content: string;
  onRetry?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2 px-4 py-1", className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-discord-status-dnd" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-discord-status-dnd">{content}</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-xs text-discord-status-dnd">メッセージの送信に失敗しました</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-xs text-discord-text-link hover:underline"
              aria-label="再送信"
            >
              <RotateCcw className="h-3 w-3" />
              再送信
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-xs text-discord-status-dnd hover:underline"
              aria-label="削除"
            >
              <Trash2 className="h-3 w-3" />
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
