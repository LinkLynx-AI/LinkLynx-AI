import type { MemberSummary } from "../model/types";

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
