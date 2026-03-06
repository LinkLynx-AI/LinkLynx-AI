// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { CreateChannelModal } from "./create-channel-modal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/shared/api/mutations/use-channel-actions", () => ({
  useCreateChannel: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

describe("CreateChannelModal", () => {
  test("disables unsupported channel types for v1", () => {
    render(<CreateChannelModal onClose={() => undefined} serverId="2001" />);

    const textButton = screen.getByText("テキスト").closest("button");
    const voiceButton = screen.getByText("ボイス").closest("button");
    const forumButton = screen.getByText("フォーラム").closest("button");

    expect(textButton).not.toBeNull();
    expect((textButton as HTMLButtonElement).disabled).toBe(false);
    expect(voiceButton).not.toBeNull();
    expect((voiceButton as HTMLButtonElement).disabled).toBe(true);
    expect(forumButton).not.toBeNull();
    expect((forumButton as HTMLButtonElement).disabled).toBe(true);
  });

  test("keeps submit disabled when server id is missing", async () => {
    render(<CreateChannelModal onClose={() => undefined} />);

    await userEvent.type(screen.getByPlaceholderText("新しいチャンネル"), "general");

    const submitButton = screen.getByRole("button", { name: "チャンネルを作成" });
    expect(submitButton).toHaveProperty("disabled", true);
  });
});
