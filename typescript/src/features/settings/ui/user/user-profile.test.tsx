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
const useMyProfileMediaDownloadUrlMock = vi.hoisted(() =>
  vi.fn<(target: "avatar" | "banner", objectKey: string | null) => { data: string | undefined }>(),
);
const useUpdateMyProfileMock = vi.hoisted(() =>
  vi.fn<(userId: string | null) => UpdateMyProfileMutationResult>(),
);
const uploadProfileMediaFileMock = vi.hoisted(() =>
  vi.fn<(target: "avatar" | "banner", file: File) => Promise<string>>(),
);

vi.mock("@/shared/api/mutations", () => ({
  useUpdateMyProfile: useUpdateMyProfileMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
  useMyProfileMediaDownloadUrl: useMyProfileMediaDownloadUrlMock,
}));

vi.mock("@/features/settings/model/profile-media", () => ({
  uploadProfileMediaFile: uploadProfileMediaFileMock,
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
        theme: "dark",
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useMyProfileMediaDownloadUrlMock.mockImplementation(
      (target: "avatar" | "banner", objectKey: string | null) => {
        if (target === "avatar" && objectKey === "avatars/old-name.png") {
          return { data: "https://cdn.example/avatar-old.png" };
        }
        if (target === "banner" && objectKey === "banners/old-banner.png") {
          return { data: "https://cdn.example/banner-old.png" };
        }
        return { data: undefined };
      },
    );
    uploadProfileMediaFileMock.mockResolvedValue("profiles/u-1/avatar/default.png");
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

  test("saves profile and updates local form state on success", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValueOnce({
      displayName: "new-name",
      statusText: "new-status",
      avatarKey: "avatars/old-name.png",
      bannerKey: "banners/old-banner.png",
      theme: "dark",
    });

    render(<UserProfile />);

    const displayNameInput = screen.getByDisplayValue("old-name");
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "new-name");

    const bioInput = screen.getByPlaceholderText("あなたについて教えてください");
    await user.clear(bioInput);
    await user.type(bioInput, "new-status");

    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        displayName: "new-name",
        statusText: "new-status",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("プロフィールを更新しました。")).not.toBeNull();
      expect(screen.getByDisplayValue("new-name")).not.toBeNull();
      expect(screen.getByDisplayValue("new-status")).not.toBeNull();
    });
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
        avatarKey: "avatars/old-name.png",
        bannerKey: "banners/old-banner.png",
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
        avatarKey: "avatars/old-name.png",
        bannerKey: "banners/old-banner.png",
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
      avatarKey: "avatars/server-updated.png",
      bannerKey: "banners/server-updated.png",
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

  test("blocks oversized avatar selection before crop or save", async () => {
    const user = userEvent.setup();

    render(<UserProfile />);

    const oversizedFile = setFileSize(
      new File(["avatar"], "large-avatar.png", { type: "image/png" }),
      PROFILE_IMAGE_SIZE_LIMIT_BYTES.avatar + 1,
    );

    await user.upload(screen.getByLabelText("アバター画像ファイル"), oversizedFile);

    expect(
      screen.getByText("アバター画像は 2MB 以下のファイルを選択してください。"),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "適用" })).toBeNull();
    expect(uploadProfileMediaFileMock).not.toHaveBeenCalled();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  test("uses persisted avatar storage URL when auth-store avatar is empty", () => {
    render(<UserProfile />);

    const avatarImage = screen.getByAltText("old-name");
    expect(avatarImage.getAttribute("src")).toBe("https://cdn.example/avatar-old.png");
  });

  test("uploads avatar and banner before saving profile", async () => {
    const user = userEvent.setup();
    uploadProfileMediaFileMock
      .mockResolvedValueOnce("profiles/u-1/avatar/new-avatar.png")
      .mockResolvedValueOnce("profiles/u-1/banner/new-banner.png");
    mutateAsyncMock.mockResolvedValueOnce({
      displayName: "old-name",
      statusText: "old-status",
      avatarKey: "profiles/u-1/avatar/new-avatar.png",
      bannerKey: "profiles/u-1/banner/new-banner.png",
      theme: "dark",
    });

    render(<UserProfile />);

    await user.upload(
      screen.getByLabelText("アバター画像ファイル"),
      new File(["avatar"], "avatar.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "適用" }));

    await user.upload(
      screen.getByLabelText("バナー画像ファイル"),
      new File(["banner"], "banner.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "適用" }));

    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(uploadProfileMediaFileMock).toHaveBeenNthCalledWith(
        1,
        "avatar",
        expect.objectContaining({ name: "avatar.png" }),
      );
      expect(uploadProfileMediaFileMock).toHaveBeenNthCalledWith(
        2,
        "banner",
        expect.objectContaining({ name: "banner.png" }),
      );
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        avatarKey: "profiles/u-1/avatar/new-avatar.png",
        bannerKey: "profiles/u-1/banner/new-banner.png",
      });
    });
  });
});
