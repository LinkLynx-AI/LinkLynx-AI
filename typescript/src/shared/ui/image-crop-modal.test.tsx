// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { ImageCropModal } from "./image-crop-modal";

describe("ImageCropModal", () => {
  const toBlobMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:cropped-avif"),
      }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      scale: vi.fn(),
      translate: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(toBlobMock);
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get: () => 400,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("keeps avif filename and mime aligned for cropped output", async () => {
    const user = userEvent.setup();
    const onCrop = vi.fn();
    toBlobMock.mockImplementation((callback, type) => {
      callback(new Blob(["cropped"], { type: type ?? "image/png" }));
    });

    render(
      <ImageCropModal
        imageUrl="blob:source"
        sourceFile={new File(["source"], "avatar.avif", { type: "image/avif" })}
        shape="circle"
        onCrop={onCrop}
        onClose={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => {
      expect(onCrop).toHaveBeenCalledTimes(1);
    });

    const result = onCrop.mock.calls[0][0] as { file: File; url: string };
    expect(result.file.name).toBe("avatar-cropped.avif");
    expect(result.file.type).toBe("image/avif");
    expect(result.url).toBe("blob:cropped-avif");
  });

  test("falls back to the actual blob mime when canvas encoding downgrades avif", async () => {
    const user = userEvent.setup();
    const onCrop = vi.fn();
    toBlobMock.mockImplementation((callback) => {
      callback(new Blob(["cropped"], { type: "image/png" }));
    });

    render(
      <ImageCropModal
        imageUrl="blob:source"
        sourceFile={new File(["source"], "avatar.avif", { type: "image/avif" })}
        shape="circle"
        onCrop={onCrop}
        onClose={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => {
      expect(onCrop).toHaveBeenCalledTimes(1);
    });

    const result = onCrop.mock.calls[0][0] as { file: File; url: string };
    expect(result.file.name).toBe("avatar-cropped.png");
    expect(result.file.type).toBe("image/png");
  });
});
