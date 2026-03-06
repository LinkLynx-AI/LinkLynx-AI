// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { CreateServerModal } from "./create-server-modal";

const pushMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/shared/api/mutations/use-server-actions", () => ({
  useCreateServer: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}));

describe("CreateServerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("navigates to created server route on success", async () => {
    mutateAsyncMock.mockResolvedValueOnce({ id: "2001" });
    const onClose = vi.fn();

    render(<CreateServerModal onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /オリジナル/ }));
    await userEvent.click(screen.getByRole("button", { name: /自分とフレンド用/ }));
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({ name: "のサーバー" });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/channels/2001");
    });
  });

  test("shows inline error text on create failure", async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      new GuildChannelApiError("validation", { code: "VALIDATION_ERROR" }),
    );

    render(<CreateServerModal onClose={() => undefined} />);

    await userEvent.click(screen.getByRole("button", { name: /オリジナル/ }));
    await userEvent.click(screen.getByRole("button", { name: /自分とフレンド用/ }));
    await userEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(screen.getByText("入力内容を確認してください。")).not.toBeNull();
    });
  });
});
