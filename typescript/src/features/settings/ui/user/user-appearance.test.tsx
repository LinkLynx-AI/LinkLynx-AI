// @vitest-environment jsdom
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { useAuthStore } from "@/shared/model/stores/auth-store";

type MyProfile = {
  displayName: string;
  statusText: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
  theme: "dark" | "light";
};

type MyProfileQueryResult = {
  data: MyProfile | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
};

type UpdateMyProfileMutationResult = {
  isPending: boolean;
  mutateAsync: (input: unknown) => Promise<MyProfile>;
};

const mutateAsyncMock = vi.hoisted(() => vi.fn<(input: unknown) => Promise<MyProfile>>());
const useMyProfileMock = vi.hoisted(() => vi.fn<(userId: string | null) => MyProfileQueryResult>());
const useUpdateMyProfileMock = vi.hoisted(() =>
  vi.fn<(userId: string | null) => UpdateMyProfileMutationResult>(),
);

vi.mock("@/shared/api/mutations", () => ({
  useUpdateMyProfile: useUpdateMyProfileMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
}));

import { UserAppearance } from "./user-appearance";

describe("UserAppearance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      currentUser: {
        id: "u-1",
        username: "alice",
        displayName: "Alice",
        avatar: null,
        status: "online",
        customStatus: "ready",
        bot: false,
      },
      currentPrincipalId: null,
      status: "online",
      customStatus: "ready",
    });
    useUpdateMyProfileMock.mockReturnValue({
      isPending: false,
      mutateAsync: mutateAsyncMock,
    });
    useMyProfileMock.mockReturnValue({
      data: {
        displayName: "Alice",
        statusText: "ready",
        avatarKey: null,
        bannerKey: null,
        theme: "dark",
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    useAuthStore.setState({
      currentUser: null,
      currentPrincipalId: null,
      status: "online",
      customStatus: null,
    });
  });

  test("hydrates the selected theme from my profile", async () => {
    render(<UserAppearance />);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "ダーク" }).getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(screen.getByRole("radio", { name: "ライト" }).getAttribute("aria-checked")).toBe(
        "false",
      );
    });
  });

  test("saves theme-only changes", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValueOnce({
      displayName: "Alice",
      statusText: "ready",
      avatarKey: null,
      bannerKey: null,
      theme: "light",
    });

    render(<UserAppearance />);

    await user.click(screen.getByRole("radio", { name: "ライト" }));
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({ theme: "light" });
      expect(screen.getByText("外観設定を更新しました。")).not.toBeNull();
    });
  });

  test("keeps unsaved selection when profile query is refreshed", async () => {
    const user = userEvent.setup();
    const queryResult: MyProfileQueryResult = {
      data: {
        displayName: "Alice",
        statusText: "ready",
        avatarKey: null,
        bannerKey: null,
        theme: "dark",
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    useMyProfileMock.mockImplementation(() => queryResult);

    const { rerender } = render(<UserAppearance />);

    await user.click(screen.getByRole("radio", { name: "ライト" }));

    queryResult.data = {
      displayName: "Alice",
      statusText: "ready",
      avatarKey: null,
      bannerKey: null,
      theme: "dark",
    };
    act(() => {
      rerender(<UserAppearance />);
    });

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "ライト" }).getAttribute("aria-checked")).toBe(
        "true",
      );
    });
  });

  test("shows retry action when profile fetch fails", async () => {
    const user = userEvent.setup();
    const refetchMock = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    useMyProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("failed to fetch appearance"),
      refetch: refetchMock,
    });

    render(<UserAppearance />);

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  test("shows an error message when save fails", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValueOnce(
      new GuildChannelApiError("appearance update failed", {
        requestId: "req-933",
      }),
    );

    render(<UserAppearance />);

    await user.click(screen.getByRole("radio", { name: "ライト" }));
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(screen.getByText(/request_id: req-933/)).not.toBeNull();
    });
  });
});
