// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@/test/test-utils";
import { ChannelView } from "./channel-view";

const replaceMock = vi.hoisted(() => vi.fn());
const useChannelMock = vi.hoisted(() => vi.fn());
const useChannelsMock = vi.hoisted(() => vi.fn());
const useSyncChannelIdMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/shared/api/queries/use-channels", () => ({
  useChannel: useChannelMock,
  useChannels: useChannelsMock,
}));

vi.mock("@/shared/model/hooks/use-sync-guild-params", () => ({
  useSyncChannelId: useSyncChannelIdMock,
}));

vi.mock("@/features/voice", () => ({
  VoiceArea: () => <div>voice-area</div>,
  StageChannelView: () => <div>stage-channel-view</div>,
}));

vi.mock("@/features/forum", () => ({
  ForumView: () => <div>forum-view</div>,
}));

vi.mock("./chat-area", () => ({
  ChatArea: ({ channelId, channelName }: { channelId: string; channelName: string }) => (
    <div data-testid="chat-area">{`${channelName}:${channelId}`}</div>
  ),
}));

describe("ChannelView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChannelMock.mockReturnValue({
      data: {
        id: "3100",
        guildId: "2001",
        type: 4,
        name: "times",
        topic: null,
        position: 0,
        parentId: null,
        nsfw: false,
        rateLimitPerUser: 0,
        lastMessageId: null,
      },
    });
    useChannelsMock.mockReturnValue({
      data: [
        {
          id: "3100",
          guildId: "2001",
          type: 4,
          name: "times",
          topic: null,
          position: 0,
          parentId: null,
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
        {
          id: "3200",
          guildId: "2001",
          type: 0,
          name: "times-abe",
          topic: null,
          position: 1,
          parentId: "3100",
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
      ],
      isSuccess: true,
    });
  });

  test("redirects category route to the first text channel in the guild", async () => {
    render(<ChannelView channelId="3100" guildId="2001" />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/channels/2001/3200");
    });
  });

  test("redirects category route to guild root when no text channel is available", async () => {
    useChannelsMock.mockReturnValue({
      data: [
        {
          id: "3100",
          guildId: "2001",
          type: 4,
          name: "times",
          topic: null,
          position: 0,
          parentId: null,
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
      ],
      isSuccess: true,
    });

    render(<ChannelView channelId="3100" guildId="2001" />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/channels/2001");
    });
  });

  test("waits for guild channel list before redirecting category route", async () => {
    const loadedChannels = [
      {
        id: "3100",
        guildId: "2001",
        type: 4 as const,
        name: "times",
        topic: null,
        position: 0,
        parentId: null,
        nsfw: false,
        rateLimitPerUser: 0,
        lastMessageId: null,
      },
      {
        id: "3200",
        guildId: "2001",
        type: 0 as const,
        name: "times-abe",
        topic: null,
        position: 1,
        parentId: "3100",
        nsfw: false,
        rateLimitPerUser: 0,
        lastMessageId: null,
      },
    ];
    let isLoaded = false;
    useChannelsMock.mockImplementation(() => ({
      data: isLoaded ? loadedChannels : undefined,
      isSuccess: isLoaded,
    }));

    const view = render(<ChannelView channelId="3100" guildId="2001" />);

    expect(replaceMock).not.toHaveBeenCalled();

    isLoaded = true;
    view.rerender(<ChannelView channelId="3100" guildId="2001" />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/channels/2001/3200");
    });
  });
});
