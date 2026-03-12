// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { PROFILE_IMAGE_SIZE_LIMIT_BYTES } from "../../lib/profile-image";
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
  mutateAsync: (input: unknown) => Promise<unknown>;
};

const mutateAsyncMock = vi.hoisted(() => vi.fn<(input: unknown) => Promise<unknown>>());
const useMyProfileMock = vi.hoisted(() => vi.fn<(userId: string | null) => MyProfileQueryResult>());
const useUpdateMyProfileMock = vi.hoisted(() =>
  vi.fn<(userId: string | null) => UpdateMyProfileMutationResult>(),
);
const createMyProfileMediaUploadUrlMock = vi.hoisted(() =>
  vi.fn<(input: { target: "avatar" | "banner"; filename: string; contentType: string }) => Promise<unknown>>(),
);
const getMyProfileMediaDownloadUrlMock = vi.hoisted(() =>
  vi.fn<(target: "avatar" | "banner") => Promise<unknown>>(),
);
const fetchMock = vi.hoisted(() => vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>());
const createObjectUrlMock = vi.hoisted(() => vi.fn<(file: File) => string>());
const revokeObjectUrlMock = vi.hoisted(() => vi.fn<(url: string) => void>());
const apiClientMock = vi.hoisted(() => ({
  createMyProfileMediaUploadUrl: createMyProfileMediaUploadUrlMock,
  getMyProfileMediaDownloadUrl: getMyProfileMediaDownloadUrlMock,
}));

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => apiClientMock,
}));

vi.mock("@/shared/api/mutations", () => ({
  useUpdateMyProfile: useUpdateMyProfileMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
}));

import { UserProfile } from "./user-profile";

function setFileSize(file: File, size: number): File {
  Object.defineProperty(file, "size", {
    configurable: true,
    value: size,
  });
  return file;
}

describe("UserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    createObjectUrlMock.mockImplementation((file) => `blob:${file.name}`);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
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
      currentPrincipalId: null,
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
        theme: "dark",
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({
      currentUser: null,
      currentPrincipalId: null,
      status: "online",
      customStatus: null,
    });
  });

  test("uploads avatar and banner selections before saving profile", async () => {
    const user = userEvent.setup();
    createMyProfileMediaUploadUrlMock.mockImplementation(async ({ target, filename, contentType }) => ({
      target,
      objectKey: `${target}/${filename}`,
      uploadUrl: `https://upload.example/${target}`,
      expiresAt: "2026-03-12T12:00:00Z",
      method: "PUT",
      requiredHeaders: {
        "content-type": contentType,
      },
    }));
    getMyProfileMediaDownloadUrlMock.mockImplementation(async (target) => ({
      target,
      objectKey: target === "avatar" ? "avatar/avatar.png" : "banner/banner.png",
      downloadUrl:
        target === "avatar" ? "https://cdn.example/avatar.png" : "https://cdn.example/banner.png",
      expiresAt: "2026-03-12T12:00:00Z",
    }));
    mutateAsyncMock.mockResolvedValueOnce({
      displayName: "new-name",
      statusText: "new-status",
      avatarKey: "avatar/avatar.png",
      bannerKey: "banner/banner.png",
      theme: "dark",
    });

    const { container } = render(<UserProfile />);

    const displayNameInput = screen.getByDisplayValue("old-name");
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "new-name");

    const bioInput = screen.getByPlaceholderText("あなたについて教えてください");
    await user.clear(bioInput);
    await user.type(bioInput, "new-status");

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const avatarInput = fileInputs[0];
    const bannerInput = fileInputs[1];
    if (!(avatarInput instanceof HTMLInputElement) || !(bannerInput instanceof HTMLInputElement)) {
      throw new Error("file inputs not found");
    }

    await user.upload(avatarInput, new File(["avatar"], "avatar.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "適用" }));

    await user.upload(bannerInput, new File(["banner"], "banner.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "適用" }));

    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(createMyProfileMediaUploadUrlMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        displayName: "new-name",
        statusText: "new-status",
        avatarKey: "avatar/avatar.png",
        bannerKey: "banner/banner.png",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("プロフィールを更新しました。")).not.toBeNull();
    });
    expect(useAuthStore.getState().currentUser?.avatar).toBe("https://cdn.example/avatar.png");
    expect(useMyProfileMock).toHaveBeenCalledWith("u-1");
    expect(useUpdateMyProfileMock).toHaveBeenCalledWith("u-1");
  });

  test("shows retry action when update fails and can retry", async () => {
    const user = userEvent.setup();
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
        theme: "dark",
      });

    render(<UserProfile />);

    const bioInput = screen.getByPlaceholderText("あなたについて教えてください");
    await user.clear(bioInput);
    await user.type(bioInput, "retry-status");

    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(screen.getByText(/request_id: req-807/)).not.toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("プロフィールを更新しました。")).not.toBeNull();
    });
  });

  test("keeps unsaved bio when profile query data is refreshed", async () => {
    const user = userEvent.setup();
    const queryResult: MyProfileQueryResult = {
      data: {
        displayName: "old-name",
        statusText: "old-status",
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

    const { rerender } = render(<UserProfile />);

    const bioInput = screen.getByPlaceholderText("あなたについて教えてください");
    await user.clear(bioInput);
    await user.type(bioInput, "draft-status");

    queryResult.data = {
      displayName: "old-name",
      statusText: "server-updated-status",
      avatarKey: null,
      bannerKey: null,
      theme: "light",
    };
    act(() => {
      rerender(<UserProfile />);
    });

    await waitFor(() => {
      const latestBioInput = screen.getByPlaceholderText("あなたについて教えてください");
      if (!(latestBioInput instanceof HTMLTextAreaElement)) {
        throw new Error("bio input is not a textarea element");
      }
      expect(latestBioInput.value).toBe("draft-status");
    });
  });

  test("blocks oversized avatar selection before crop or save", async () => {
    const user = userEvent.setup();
    const { container } = render(<UserProfile />);
    const avatarInput = container.querySelector('input[type="file"]');
    if (!(avatarInput instanceof HTMLInputElement)) {
      throw new Error("avatar input not found");
    }

    const oversizedFile = setFileSize(
      new File(["avatar"], "large-avatar.png", { type: "image/png" }),
      PROFILE_IMAGE_SIZE_LIMIT_BYTES.avatar + 1,
    );

    await user.upload(avatarInput, oversizedFile);

    expect(
      screen.getByText("アバター画像は 2MB 以下のファイルを選択してください。"),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "適用" })).toBeNull();
    expect(createMyProfileMediaUploadUrlMock).not.toHaveBeenCalled();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  test("calls refetch when profile fetch fails and retry is clicked", async () => {
    const user = userEvent.setup();
    const refetchMock = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    useMyProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("failed to fetch profile"),
      refetch: refetchMock,
    });

    render(<UserProfile />);

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
