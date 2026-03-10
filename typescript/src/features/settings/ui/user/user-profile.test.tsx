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
const useStorageObjectUrlMock = vi.hoisted(() =>
  vi.fn<(objectKey: string | null) => { data: string | undefined }>(),
);
const useUpdateMyProfileMock = vi.hoisted(() =>
  vi.fn<(userId: string | null) => UpdateMyProfileMutationResult>(),
);
const uploadProfileMediaFileMock = vi.hoisted(() =>
  vi.fn<(userId: string, target: "avatar" | "banner", file: File) => Promise<string>>(),
);
const cleanupUploadedProfileMediaKeysMock = vi.hoisted(() =>
  vi.fn<(objectKeys: string[]) => Promise<void>>(),
);

vi.mock("@/shared/api/mutations", () => ({
  useUpdateMyProfile: useUpdateMyProfileMock,
}));

const getStorageObjectUrlMock = vi.hoisted(() => vi.fn<(objectKey: string) => Promise<string>>());

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
  useStorageObjectUrl: useStorageObjectUrlMock,
}));

vi.mock("@/shared/lib", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib")>("@/shared/lib");
  return {
    ...actual,
    getStorageObjectUrl: getStorageObjectUrlMock,
  };
});

vi.mock("@/features/settings/model/profile-media", () => ({
  uploadProfileMediaFile: uploadProfileMediaFileMock,
  cleanupUploadedProfileMediaKeys: cleanupUploadedProfileMediaKeysMock,
}));

vi.mock("@/shared/ui/image-crop-modal", () => ({
  ImageCropModal: ({
    imageUrl,
    sourceFile,
    onCrop,
    onClose,
  }: {
    imageUrl: string;
    sourceFile: File;
    onCrop: (result: { file: File; url: string }) => void;
    onClose: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onCrop({ file: sourceFile, url: imageUrl })}>
        適用
      </button>
      <button type="button" onClick={onClose}>
        キャンセル
      </button>
    </div>
  ),
}));

import { UserProfile } from "./user-profile";

describe("UserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn((value: Blob | File) => {
          if (value instanceof File) {
            return `blob:${value.name}`;
          }
          return "blob:cropped-image";
        }),
        revokeObjectURL: vi.fn(),
      }),
    );
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
        avatarKey: "avatars/old-name.png",
        bannerKey: "banners/old-banner.png",
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useStorageObjectUrlMock.mockImplementation((objectKey: string | null) => {
      switch (objectKey) {
        case "avatars/old-name.png":
          return { data: "https://cdn.example/avatar-old.png" };
        case "banners/old-banner.png":
          return { data: "https://cdn.example/banner-old.png" };
        default:
          return { data: undefined };
      }
    });
    uploadProfileMediaFileMock.mockResolvedValue("profiles/u-1/avatar/default.png");
    getStorageObjectUrlMock.mockImplementation(async (objectKey: string) => `https://cdn.example/${objectKey}`);
    cleanupUploadedProfileMediaKeysMock.mockResolvedValue(undefined);
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
        avatarKey: "avatars/old-name.png",
        bannerKey: "banners/old-banner.png",
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
      avatarKey: "avatars/server-updated.png",
      bannerKey: "banners/server-updated.png",
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

  test("uses persisted avatar storage URL when auth-store avatar is empty", async () => {
    render(<UserProfile />);

    const avatarImage = screen.getByAltText("old-name");
    expect(avatarImage.getAttribute("src")).toBe("https://cdn.example/avatar-old.png");
  });

  test("uploads avatar and banner before saving profile", async () => {
    uploadProfileMediaFileMock
      .mockResolvedValueOnce("profiles/u-1/avatar/new-avatar.png")
      .mockResolvedValueOnce("profiles/u-1/banner/new-banner.png");
    mutateAsyncMock.mockResolvedValueOnce({
      displayName: "old-name",
      statusText: "old-status",
      avatarKey: "profiles/u-1/avatar/new-avatar.png",
      bannerKey: "profiles/u-1/banner/new-banner.png",
    });

    render(<UserProfile />);

    await userEvent.upload(
      screen.getByLabelText("アバター画像ファイル"),
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "適用" }));

    await userEvent.upload(
      screen.getByLabelText("バナー画像ファイル"),
      new File(["banner"], "banner.png", { type: "image/png" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "適用" }));

    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(uploadProfileMediaFileMock).toHaveBeenNthCalledWith(
        1,
        "u-1",
        "avatar",
        expect.objectContaining({ name: "avatar.png" }),
      );
      expect(uploadProfileMediaFileMock).toHaveBeenNthCalledWith(
        2,
        "u-1",
        "banner",
        expect.objectContaining({ name: "banner.png" }),
      );
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        avatarKey: "profiles/u-1/avatar/new-avatar.png",
        bannerKey: "profiles/u-1/banner/new-banner.png",
      });
      expect(useAuthStore.getState().currentUser?.avatar).toBe(
        "https://cdn.example/profiles/u-1/avatar/new-avatar.png",
      );
    });
    expect(getStorageObjectUrlMock).toHaveBeenCalledWith("profiles/u-1/avatar/new-avatar.png");
  });
});
