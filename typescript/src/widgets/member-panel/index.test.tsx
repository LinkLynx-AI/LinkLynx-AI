/** @vitest-environment happy-dom */

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { MemberSummary } from "@/entities";
import { MemberPanel } from "./index";

const demoMembers: MemberSummary[] = [
  {
    id: "member-1",
    displayName: "LinkLynx Bot",
    statusLabel: "Online",
    avatarLabel: "LB",
  },
  {
    id: "member-2",
    displayName: "Design Reviewer",
    statusLabel: "Away",
    avatarLabel: "DR",
  },
];

describe("MemberPanel", () => {
  test("メンバー一覧を MemberAvatar で描画する", () => {
    render(<MemberPanel members={demoMembers} title="Channel members" />);

    expect(screen.getByRole("heading", { name: "Channel members" })).toBeTruthy();
    expect(screen.getByText("LinkLynx Bot")).toBeTruthy();
    expect(screen.getByText("Design Reviewer")).toBeTruthy();
    expect(screen.getByText("LB")).toBeTruthy();
    expect(screen.getByText("DR")).toBeTruthy();
  });

  test("メンバー未存在時は空状態メッセージを表示する", () => {
    render(<MemberPanel members={[]} />);

    expect(screen.getByText("表示できるメンバーはいません。")).toBeTruthy();
  });

  test("右パネル開閉を阻害しないレイアウトクラスを維持する", () => {
    render(<MemberPanel members={demoMembers} />);

    const panel = screen.getByLabelText("member-panel");
    const list = screen.getByLabelText("member-panel-list");

    expect(panel.className).toContain("min-w-0");
    expect(panel.className).toContain("overflow-hidden");
    expect(list.className).toContain("min-h-0");
    expect(list.className).toContain("overflow-y-auto");
  });
});
