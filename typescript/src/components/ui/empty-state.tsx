import { cn } from "@/lib/cn";
import { Search, Users, Pin, MessageSquare } from "lucide-react";

const variantConfig = {
  "no-results": {
    icon: Search,
    title: "結果が見つかりません",
    description: "検索条件を変更して、もう一度お試しください。",
  },
  "no-friends": {
    icon: Users,
    title: "フレンドがいません",
    description: "フレンドを追加して、会話を始めましょう。",
  },
  "no-pins": {
    icon: Pin,
    title: "ピン留めされたメッセージはありません",
    description: "メッセージをピン留めすると、ここに表示されます。",
  },
  "no-threads": {
    icon: MessageSquare,
    title: "スレッドはありません",
    description: "スレッドを作成すると、ここに表示されます。",
  },
} as const;

type EmptyStateVariant = keyof typeof variantConfig;

export function EmptyState({
  variant,
  title,
  description,
  icon: CustomIcon,
  action,
  className,
}: {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  const config = variant ? variantConfig[variant] : null;
  const Icon = CustomIcon ?? config?.icon;
  const displayTitle = title ?? config?.title ?? "";
  const displayDescription = description ?? config?.description ?? "";

  return (
    <div
      className={cn("flex flex-col items-center justify-center px-8 py-16 text-center", className)}
    >
      {Icon && <Icon className="mb-4 h-10 w-10 text-discord-text-muted" aria-hidden="true" />}
      {displayTitle && (
        <h3 className="text-base font-semibold text-discord-header-primary">{displayTitle}</h3>
      )}
      {displayDescription && (
        <p className="mt-1 max-w-xs text-sm text-discord-text-muted">{displayDescription}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "mt-4 rounded-md bg-discord-brand-blurple px-4 py-2 text-sm font-medium text-white",
            "hover:bg-discord-brand-blurple-hover transition-colors",
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
