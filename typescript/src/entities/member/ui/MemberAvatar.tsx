import { getMemberInitials } from "../lib/getMemberInitials";
import type { MemberSummary } from "../model/types";
import { classNames } from "@/shared";

const sizeClassMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

type MemberAvatarSize = keyof typeof sizeClassMap;

type MemberAvatarProps = {
  member: MemberSummary;
  size?: MemberAvatarSize;
};

export function MemberAvatar({ member, size = "md" }: MemberAvatarProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className={classNames(
          "flex items-center justify-center rounded-full bg-discord-primary font-semibold text-white",
          sizeClassMap[size]
        )}
      >
        {getMemberInitials(member)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{member.displayName}</p>
        <p className="truncate text-xs text-white/70">{member.statusLabel}</p>
      </div>
    </div>
  );
}
