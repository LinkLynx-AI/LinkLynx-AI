import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getFirebaseAuthMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("./auth", () => ({
  getFirebaseAuth: getFirebaseAuthMock,
}));

import {
  deleteStorageObjectByKey,
  getStorageObjectUrl,
  StorageProxyError,
  uploadStorageObject,
} from "./storage";

describe("storage proxy client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getFirebaseAuthMock.mockReset();
    getFirebaseAuthMock.mockReturnValue({
      currentUser: {
        getIdToken: vi.fn().mockResolvedValue("token-1"),
      },
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("ダウンロード URL 取得時に Bearer を付与する", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "https://example.com/avatar.png" }), { status: 200 }),
    );

    const url = await getStorageObjectUrl("profiles/u-1/avatar/avatar.png");

    expect(url).toBe("https://example.com/avatar.png");
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("/api/storage/object?objectKey=profiles%2Fu-1%2Favatar%2Favatar.png");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token-1");
  });

  test("ダウンロード URL が解決できない場合は null を返す", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ url: null }), { status: 200 }));

    await expect(getStorageObjectUrl("profiles/u-1/avatar/missing.png")).resolves.toBeNull();
  });

  test("アップロード時に formData を送る", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await uploadStorageObject(
      "profiles/u-1/avatar/avatar.png",
      new File(["avatar"], "avatar.png", { type: "image/png" }),
      "image/png",
    );

    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("/api/storage/object");
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token-1");
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get("objectKey")).toBe("profiles/u-1/avatar/avatar.png");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  test("削除時に JSON body を送る", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await deleteStorageObjectByKey("profiles/u-1/banner/banner.png");

    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("/api/storage/object");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token-1");
    expect(init.body).toBe(JSON.stringify({ objectKey: "profiles/u-1/banner/banner.png" }));
  });

  test("未認証時は fetch 前に失敗する", async () => {
    getFirebaseAuthMock.mockReturnValue({ currentUser: null });

    await expect(getStorageObjectUrl("profiles/u-1/avatar/avatar.png")).rejects.toMatchObject({
      name: "StorageProxyError",
      code: "unauthenticated",
    } satisfies Partial<StorageProxyError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
