// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { ChannelEditOverview } from "./channel-edit-overview";

const useChannelMock = vi.hoisted(() => vi.fn());
const useUpdateChannelMock = vi.hoisted(() => vi.fn());
const mutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries/use-channels", () => ({
  useChannel: useChannelMock,
}));

vi.mock("@/shared/api/mutations/use-channel-update", () => ({
  useUpdateChannel: useUpdateChannelMock,
}));

function createChannel(name: string) {
  return {
    id: "3001",
    guildId: "2001",
    type: 0 as const,
    name,
    topic: null,
    position: 0,
    parentId: null,
    nsfw: false,
    rateLimitPerUser: 0,
    lastMessageId: null,
  };
}

describe("ChannelEditOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChannelMock.mockReturnValue({
      data: createChannel("general"),
      isLoading: false,
    });
    useUpdateChannelMock.mockReturnValue({
      isPending: false,
      mutateAsync: mutateAsyncMock,
    });
  });

  test("submits name patch and closes modal on success", async () => {
    mutateAsyncMock.mockResolvedValueOnce(createChannel("release-notes"));
    const onSaved = vi.fn();

    render(<ChannelEditOverview channelId="3001" onSaved={onSaved} />);

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "release-notes");
    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        channelId: "3001",
        data: { name: "release-notes" },
      });
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  test("shows mapped authz error message when update fails", async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      new GuildChannelApiError("denied", { code: "AUTHZ_DENIED" }),
    );

    render(<ChannelEditOverview channelId="3001" />);

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "release-notes");
    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(screen.getByText("この操作を行う権限がありません。")).not.toBeNull();
    });
  });

  test("keeps save disabled while name is unchanged", () => {
    render(<ChannelEditOverview channelId="3001" />);

    expect(screen.getByRole("button", { name: "変更を保存" })).toHaveProperty("disabled", true);
  });

  test("shows inline error when name exceeds max length", async () => {
    render(<ChannelEditOverview channelId="3001" />);

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "a".repeat(101));
    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(screen.getByText("チャンネル名は100文字以内で入力してください。")).not.toBeNull();
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
