// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useVoiceStore } from "@/shared/model/stores/voice-store";
import { UserPanel } from "./user-panel";

const usePathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/shared/ui/tooltip-simple", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

describe("UserPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/channels/2001/3001");

    act(() => {
      useAuthStore.setState({
        currentUser: {
          id: "u-1",
          username: "alice",
          displayName: "Alice",
          avatar: null,
          status: "online",
          customStatus: null,
          bot: false,
        },
        currentPrincipalId: null,
        status: "online",
        customStatus: "in channel",
      });
      useVoiceStore.setState({
        connected: false,
        channelId: null,
        serverId: null,
        selfMuted: false,
        selfDeafened: false,
        cameraOn: false,
        screenSharing: false,
        participants: [],
      });
    });
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({
        currentUser: null,
        currentPrincipalId: null,
        status: "online",
        customStatus: null,
      });
      useVoiceStore.setState({
        connected: false,
        channelId: null,
        serverId: null,
        selfMuted: false,
        selfDeafened: false,
        cameraOn: false,
        screenSharing: false,
        participants: [],
      });
    });
  });

  test("settings link points to profile route with current pathname as returnTo", () => {
    render(<UserPanel />);

    expect(screen.getByRole("link", { name: "ユーザー設定" }).getAttribute("href")).toBe(
      "/settings/profile?returnTo=%2Fchannels%2F2001%2F3001",
    );
  });
});
