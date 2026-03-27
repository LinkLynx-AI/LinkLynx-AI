// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ChannelSidebar } from "./channel-sidebar";

const usePathnameMock = vi.hoisted(() => vi.fn());
const useChannelsMock = vi.hoisted(() => vi.fn());
const useServerMock = vi.hoisted(() => vi.fn());
const useGuildStoreMock = vi.hoisted(() => vi.fn());
const useUIStoreMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/shared/api/queries/use-channels", () => ({
  useChannels: useChannelsMock,
}));

vi.mock("@/shared/api/queries/use-servers", () => ({
  useServer: useServerMock,
}));

vi.mock("@/shared/model/stores/guild-store", () => ({
  useGuildStore: useGuildStoreMock,
}));

vi.mock("@/shared/model/stores/ui-store", () => ({
  useUIStore: useUIStoreMock,
}));

vi.mock("./server-header", () => ({
  ServerHeader: ({ serverName }: { serverName: string }) => <div>{serverName}</div>,
}));

vi.mock("./channel-category", () => ({
  ChannelCategory: ({
    channel,
    children,
  }: {
    channel: { id: string; name: string };
    children: React.ReactNode;
  }) => (
    <section data-testid={`category-${channel.id}`}>
      <div>{channel.name}</div>
      {children}
    </section>
  ),
}));

vi.mock("./channel-item", () => ({
  ChannelItem: ({
    channel,
    isActive,
  }: {
    channel: { id: string; name: string };
    isActive: boolean;
  }) => (
    <div data-testid={`channel-${channel.id}`} data-active={String(isActive)}>
      {channel.name}
    </div>
  ),
}));

vi.mock("./voice-channel", () => ({
  VoiceChannel: () => <div>voice-channel</div>,
}));

vi.mock("./user-panel", () => ({
  UserPanel: () => <div>user-panel</div>,
}));

vi.mock("./voice-connection-panel", () => ({
  VoiceConnectionPanel: () => <div>voice-connection-panel</div>,
}));

describe("ChannelSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/channels/2001/3200");
    useServerMock.mockReturnValue({
      data: { name: "LinkLynx Developers" },
    });
    useChannelsMock.mockReturnValue({
      data: [
        {
          id: "3001",
          guildId: "2001",
          type: 0,
          name: "general",
          topic: null,
          position: 10,
          parentId: null,
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
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
      isLoading: false,
      isError: false,
      error: null,
    });
    useGuildStoreMock.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        activeServerId: "2001",
        activeChannelId: null,
        collapsedCategories: {},
        toggleCategory: vi.fn(),
      }),
    );
    useUIStoreMock.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        openModal: vi.fn(),
      }),
    );
  });

  test("renders mixed category and top-level channels in position order while keeping child route active", () => {
    render(<ChannelSidebar />);

    const category = screen.getByTestId("category-3100");
    const topLevelChannel = screen.getByTestId("channel-3001");
    const childChannel = screen.getByTestId("channel-3200");

    expect(
      category.compareDocumentPosition(topLevelChannel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(childChannel.getAttribute("data-active")).toBe("true");
    expect(topLevelChannel.getAttribute("data-active")).toBe("false");
  });
});
