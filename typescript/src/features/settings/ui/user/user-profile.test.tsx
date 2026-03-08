// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { useAuthStore } from "@/shared/model/stores/auth-store";

type MyProfile = {
  displayName: string;
  statusText: string | null;
  avatarKey: string | null;
  bannerKey: string | null;
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
  mutateAsync: (input: unknown) => Promise<unknown>;
};

const mutateAsyncMock = vi.hoisted(() => vi.fn<(input: unknown) => Promise<unknown>>());
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

import { UserProfile } from "./user-profile";

describe("UserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      currentUser: {
        id: "u-1",
        username: "alice",
        displayName: "old-name",
        avatar: null,
        status: "online",
        customStatus: "old-status",
        bot: false,
      },
      status: "online",
      customStatus: "old-status",
    });
    useUpdateMyProfileMock.mockReturnValue({
      isPending: false,
      mutateAsync: mutateAsyncMock,
    });
    useMyProfileMock.mockReturnValue({
      data: {
        displayName: "old-name",
        statusText: "old-status",
        avatarKey: null,
        bannerKey: null,
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
      status: "online",
      customStatus: null,
    });
  });

  test("saves profile and syncs auth-store on success", async () => {
    mutateAsyncMock.mockResolvedValueOnce({
      displayName: "new-name",
      statusText: "new-status",
      avatarKey: null,
      bannerKey: null,
    });

    render(<UserProfile />);

    const displayNameInput = screen.getByDisplayValue("old-name");
    await userEvent.clear(displayNameInput);
    await userEvent.type(displayNameInput, "new-name");

    const bioInput = screen.getByPlaceholderText("あなたについて教えてください");
    await userEvent.clear(bioInput);
    await userEvent.type(bioInput, "new-status");

    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        displayName: "new-name",
        statusText: "new-status",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("プロフィールを更新しました。")).not.toBeNull();
      expect(useAuthStore.getState().currentUser?.displayName).toBe("new-name");
      expect(useAuthStore.getState().customStatus).toBe("new-status");
    });
    expect(useMyProfileMock).toHaveBeenCalledWith("u-1");
    expect(useUpdateMyProfileMock).toHaveBeenCalledWith("u-1");
  });

  test("shows retry action when update fails and can retry", async () => {
    mutateAsyncMock
      .mockRejectedValueOnce(
        new GuildChannelApiError("profile update failed", {
          requestId: "req-807",
        }),
      )
      .mockResolvedValueOnce({
        displayName: "retry-name",
        statusText: "retry-status",
        avatarKey: null,
        bannerKey: null,
      });

    render(<UserProfile />);

    const bioInput = screen.getByPlaceholderText("あなたについて教えてください");
    await userEvent.clear(bioInput);
    await userEvent.type(bioInput, "retry-status");

    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(screen.getByText(/request_id: req-807/)).not.toBeNull();
    });

    await userEvent.click(screen.getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("プロフィールを更新しました。")).not.toBeNull();
    });
  });

  test("keeps unsaved bio when profile query data is refreshed", async () => {
    const queryResult: MyProfileQueryResult = {
      data: {
        displayName: "old-name",
        statusText: "old-status",
        avatarKey: null,
        bannerKey: null,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
    useMyProfileMock.mockImplementation(() => queryResult);

    const { rerender } = render(<UserProfile />);

    const bioInput = screen.getByPlaceholderText("あなたについて教えてください");
    await userEvent.clear(bioInput);
    await userEvent.type(bioInput, "draft-status");

    queryResult.data = {
      displayName: "old-name",
      statusText: "server-updated-status",
      avatarKey: null,
      bannerKey: null,
    };
    rerender(<UserProfile />);

    await waitFor(() => {
      const latestBioInput = screen.getByPlaceholderText("あなたについて教えてください");
      if (!(latestBioInput instanceof HTMLTextAreaElement)) {
        throw new Error("bio input is not a textarea element");
      }
      expect(latestBioInput.value).toBe("draft-status");
    });
  });

  test("calls refetch when profile fetch fails and retry is clicked", async () => {
    const refetchMock = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    useMyProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("failed to fetch profile"),
      refetch: refetchMock,
    });

    render(<UserProfile />);

    await userEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
