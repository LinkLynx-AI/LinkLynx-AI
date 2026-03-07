// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { CreateChannelModal } from "./create-channel-modal";

const mutateAsyncMock = vi.hoisted(() => vi.fn());
const useActionGuardMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/shared/api/mutations/use-channel-actions", () => ({
  useCreateChannel: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock("@/shared/api/queries", () => ({
  useActionGuard: useActionGuardMock,
}));

describe("CreateChannelModal", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    useActionGuardMock.mockImplementation(() => ({
      status: "allowed",
      isAllowed: true,
      message: null,
    }));
  });

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

  test("shows guard message and keeps submit disabled when create permission is missing", async () => {
    useActionGuardMock.mockImplementation(() => ({
      status: "forbidden",
      isAllowed: false,
      message: "この操作を行う権限がありません。",
    }));

    render(<CreateChannelModal onClose={() => undefined} serverId="2001" />);

    await userEvent.type(screen.getByPlaceholderText("新しいチャンネル"), "general");

    expect(screen.getByText("この操作を行う権限がありません。")).not.toBeNull();
    expect(screen.getByRole("button", { name: "チャンネルを作成" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
