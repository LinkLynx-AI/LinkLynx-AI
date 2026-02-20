import { describe, expect, test } from "vitest";
import { getMemberInitials } from "@/entities/member";

describe("getMemberInitials", () => {
  test("displayName から先頭2語のイニシャルを返す", () => {
    expect(
      getMemberInitials({
        id: "member-1",
        displayName: "Link Lynx",
        statusLabel: "online",
        avatarLabel: "ll",
      })
    ).toBe("LL");
  });

  test("displayName が空の場合は avatarLabel を使う", () => {
    expect(
      getMemberInitials({
        id: "member-2",
        displayName: " ",
        statusLabel: "online",
        avatarLabel: "ab",
      })
    ).toBe("AB");
  });

  test("displayName と avatarLabel が空の場合は ?? を返す", () => {
    expect(
      getMemberInitials({
        id: "member-3",
        displayName: "",
        statusLabel: "offline",
        avatarLabel: "",
      })
    ).toBe("??");
  });
});
