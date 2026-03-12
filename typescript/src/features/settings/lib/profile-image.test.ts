import { describe, expect, test } from "vitest";
import {
  PROFILE_IMAGE_SIZE_LIMIT_BYTES,
  getProfileImageSizeHint,
  validateProfileImageFile,
} from "./profile-image";

describe("profile-image", () => {
  test("returns size hints for avatar and banner", () => {
    expect(getProfileImageSizeHint("avatar")).toBe("アバター画像は 2MB まで選択できます。");
    expect(getProfileImageSizeHint("banner")).toBe("バナー画像は 6MB まで選択できます。");
  });

  test("accepts files within the configured limit", () => {
    expect(
      validateProfileImageFile("avatar", { size: PROFILE_IMAGE_SIZE_LIMIT_BYTES.avatar }),
    ).toBeNull();
    expect(
      validateProfileImageFile("banner", { size: PROFILE_IMAGE_SIZE_LIMIT_BYTES.banner }),
    ).toBeNull();
  });

  test("rejects files larger than the configured limit", () => {
    expect(
      validateProfileImageFile("avatar", { size: PROFILE_IMAGE_SIZE_LIMIT_BYTES.avatar + 1 }),
    ).toBe("アバター画像は 2MB 以下のファイルを選択してください。");
    expect(
      validateProfileImageFile("banner", { size: PROFILE_IMAGE_SIZE_LIMIT_BYTES.banner + 1 }),
    ).toBe("バナー画像は 6MB 以下のファイルを選択してください。");
  });
});
