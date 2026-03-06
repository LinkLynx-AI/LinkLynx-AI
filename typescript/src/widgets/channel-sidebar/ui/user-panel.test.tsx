// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen, userEvent } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { useVoiceStore } from "@/shared/model/stores/voice-store";

vi.mock("@/shared/ui/tooltip-simple", () => ({
  Tooltip: ({ children }: PropsWithChildren) => <>{children}</>,
}));

import { UserPanel } from "./user-panel";

describe("UserPanel", () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        currentUser: {
          id: "u-1",
          username: "alice",
          displayName: "Alice",
          avatar: null,
          status: "online",
          customStatus: "Working",
          bot: false,
        },
        status: "online",
        customStatus: "Working",
      });
      useUIStore.setState({
        activeModal: null,
        modalProps: {},
        contextMenu: null,
      });
      useVoiceStore.setState({
        selfMuted: false,
        selfDeafened: false,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({
        currentUser: null,
        status: "online",
        customStatus: null,
      });
      useUIStore.setState({
        activeModal: null,
        modalProps: {},
        contextMenu: null,
      });
      useVoiceStore.setState({
        selfMuted: false,
        selfDeafened: false,
      });
    });
  });

  test("opens user-settings modal when settings button is clicked", async () => {
    render(<UserPanel />);

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "ユーザー設定" }));
    });

    const state = useUIStore.getState();
    expect(state.activeModal).toBe("user-settings");
    expect(state.modalProps).toEqual({});
  });
});
