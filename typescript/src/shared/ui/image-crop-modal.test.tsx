// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { ImageCropModal } from "./image-crop-modal";

describe("ImageCropModal", () => {
  const drawImageMock = vi.fn();
  const scaleMock = vi.fn();
  const translateMock = vi.fn();
  const getContextMock = vi.fn();
  const toBlobMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get: () => 800,
    });

    getContextMock.mockReturnValue({
      drawImage: drawImageMock,
      scale: scaleMock,
      translate: translateMock,
    });
    toBlobMock.mockImplementation((callback: (blob: Blob | null) => void) => {
      callback(new Blob(["cropped"], { type: "image/png" }));
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: getContextMock,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: toBlobMock,
    });

    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:cropped"),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns cropped file result when apply is clicked", async () => {
    const onCrop = vi.fn();

    render(
      <ImageCropModal
        imageUrl="blob:original"
        sourceFile={new File(["original"], "avatar.png", { type: "image/png" })}
        shape="circle"
        onCrop={onCrop}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => {
      expect(onCrop).toHaveBeenCalledWith({
        file: expect.objectContaining({
          name: "avatar-cropped.png",
          type: "image/png",
        }),
        url: "blob:cropped",
      });
    });
    expect(drawImageMock).toHaveBeenCalledTimes(1);
  });
});
