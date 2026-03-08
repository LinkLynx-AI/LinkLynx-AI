// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { CreateInviteModal } from "./create-invite-modal";

describe("CreateInviteModal", () => {
  test("renders fail-close message and only allows closing", async () => {
    const onClose = vi.fn();

    render(<CreateInviteModal onClose={onClose} channelId="3001" />);

    expect(screen.getByText("招待の作成は現在一時停止しています。")).not.toBeNull();
    expect(
      screen.getByText("invite API と権限制御の整備が完了するまで、この機能は利用できません。"),
    ).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
