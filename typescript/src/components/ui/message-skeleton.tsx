import { cn } from "@/lib/cn";
import { Skeleton } from "./skeleton";

export function MessageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-4 px-4 py-2", className)} aria-hidden="true">
      <Skeleton width={40} height={40} rounded />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="flex items-center gap-2">
          <Skeleton width={100} height={14} />
          <Skeleton width={48} height={12} />
        </div>
        <Skeleton width="90%" height={14} />
        <Skeleton width="60%" height={14} />
      </div>
    </div>
  );
}

export function MessageSkeletonList({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 py-4", className)} role="status" aria-label="読み込み中">
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </div>
  );
}
