// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { uploadProfileMediaFile } from "./profile-media";

const createMyProfileMediaUploadUrlMock = vi.fn();

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => ({
    createMyProfileMediaUploadUrl: createMyProfileMediaUploadUrlMock,
  }),
}));

describe("uploadProfileMediaFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    );
    createMyProfileMediaUploadUrlMock.mockResolvedValue({
      objectKey: "profiles/u-1/avatar/avatar-cropped.avif",
      uploadUrl: "https://storage.example/upload",
      method: "PUT",
      requiredHeaders: {},
      expiresAt: "2026-03-15T00:00:00Z",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uses matching avif filename and mime for upload url issuance", async () => {
    const file = new File(["cropped"], "avatar-cropped.avif", { type: "image/avif" });
    Object.defineProperty(file, "size", {
      configurable: true,
      value: 1_024,
    });

    const objectKey = await uploadProfileMediaFile("avatar", file);

    expect(objectKey).toBe("profiles/u-1/avatar/avatar-cropped.avif");
    expect(createMyProfileMediaUploadUrlMock).toHaveBeenCalledWith({
      target: "avatar",
      filename: "avatar-cropped.avif",
      contentType: "image/avif",
      sizeBytes: 1_024,
    });

    const [, request] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(request.body).toBe(file);
    expect(request.headers).toBeInstanceOf(Headers);
    expect((request.headers as Headers).get("content-type")).toBe("image/avif");
  });
});
