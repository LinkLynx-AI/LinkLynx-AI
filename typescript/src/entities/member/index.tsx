import { classNames } from "@/shared";

export type MemberSummary = {
  id: string;
  displayName: string;
  statusLabel: string;
  avatarLabel: string;
};

/**
 * メンバー表示名からアバター用イニシャルを返す。
 *
 * Contract:
 * - `displayName` が空の場合は `avatarLabel` をフォールバックする
 */
export function getMemberInitials(member: MemberSummary): string {
  const names = member.displayName
    .trim()
    .split(/\s+/)
    .filter((value) => value.length > 0);

  if (names.length === 0) {
    return member.avatarLabel.slice(0, 2).toUpperCase();
  }

  return names
    .slice(0, 2)
    .map((name) => name.charAt(0).toUpperCase())
    .join("");
}

type MemberAvatarSize = "sm" | "md" | "lg";

type MemberAvatarProps = {
  member: MemberSummary;
  size?: MemberAvatarSize;
};

/**
 * メンバー名と状態を表示する共通アバターコンポーネント。
 *
 * Contract:
 * - `size` は `sm` / `md` / `lg` のみ
 */
export function MemberAvatar({ member, size = "md" }: MemberAvatarProps) {
  const sizeClass =
    size === "sm"
      ? "h-8 w-8 text-xs"
      : size === "lg"
        ? "h-12 w-12 text-base"
        : "h-10 w-10 text-sm";

  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className={classNames(
          "flex items-center justify-center rounded-full bg-discord-primary font-semibold text-white",
          sizeClass
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
