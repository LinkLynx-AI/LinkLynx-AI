import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE, GET, POST } from "./route";

const fetchMock = vi.hoisted(() => vi.fn());
const STORAGE_BUCKET = "linklynx-ai.firebasestorage.app";
const FIREBASE_APP_ID = "1:636427071040:web:e981ed46f7121f0ed0b9a5";

describe("storage object route", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", STORAGE_BUCKET);
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", FIREBASE_APP_ID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("GET は Firebase Storage metadata を経由してダウンロード URL を返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          bucket: STORAGE_BUCKET,
          name: "profiles/u-1/avatar/avatar.png",
          downloadTokens: "token-1,token-2",
        }),
        { status: 200 },
      ),
    );

    const response = await GET(
      new Request(
        "http://localhost:3000/api/storage/object?objectKey=profiles%2Fu-1%2Favatar%2Favatar.png",
        {
          headers: {
            Authorization: "Bearer token-1",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://firebasestorage.googleapis.com/v0/b/linklynx-ai.firebasestorage.app/o/profiles%2Fu-1%2Favatar%2Favatar.png",
    );
    expect(init.method).toBe("GET");
    expect((init.headers as Headers).get("Authorization")).toBe("Firebase token-1");
    expect((init.headers as Headers).get("X-Firebase-Storage-Version")).toBe("webjs/AppManager");
    expect((init.headers as Headers).get("X-Firebase-GMPID")).toBe(FIREBASE_APP_ID);

    await expect(response.json()).resolves.toEqual({
      url: "https://firebasestorage.googleapis.com/v0/b/linklynx-ai.firebasestorage.app/o/profiles%2Fu-1%2Favatar%2Favatar.png?alt=media&token=token-1",
    });
  });

  test("GET は object が無い場合でも url:null を返す", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const response = await GET(
      new Request(
        "http://localhost:3000/api/storage/object?objectKey=profiles%2Fu-1%2Favatar%2Fmissing.png",
        {
          headers: {
            Authorization: "Bearer token-1",
          },
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: null });
  });

  test("POST は multipart upload で Firebase Storage へ転送する", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const formData = new FormData();
    formData.set("objectKey", "profiles/u-1/avatar/avatar.png");
    formData.set("file", new File(["avatar"], "avatar.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost:3000/api/storage/object", {
        method: "POST",
        headers: {
          Authorization: "Bearer token-2",
        },
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://firebasestorage.googleapis.com/v0/b/linklynx-ai.firebasestorage.app/o?name=profiles%2Fu-1%2Favatar%2Favatar.png",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe("Firebase token-2");
    expect((init.headers as Headers).get("X-Firebase-Storage-Version")).toBe("webjs/AppManager");
    expect((init.headers as Headers).get("X-Firebase-GMPID")).toBe(FIREBASE_APP_ID);
    expect((init.headers as Headers).get("X-Goog-Upload-Protocol")).toBe("multipart");
    expect((init.headers as Headers).get("Content-Type")).toContain("multipart/related; boundary=");
    expect(init.body).toBeInstanceOf(Blob);
  });

  test("DELETE は Firebase Storage の object を削除する", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await DELETE(
      new Request("http://localhost:3000/api/storage/object", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer token-3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objectKey: "profiles/u-1/banner/banner.png",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://firebasestorage.googleapis.com/v0/b/linklynx-ai.firebasestorage.app/o/profiles%2Fu-1%2Fbanner%2Fbanner.png",
    );
    expect(init.method).toBe("DELETE");
    expect((init.headers as Headers).get("Authorization")).toBe("Firebase token-3");
    expect((init.headers as Headers).get("X-Firebase-Storage-Version")).toBe("webjs/AppManager");
    expect((init.headers as Headers).get("X-Firebase-GMPID")).toBe(FIREBASE_APP_ID);
  });

  test("Authorization が無い場合は 401 を返す", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/storage/object?objectKey=profiles%2Fu-1%2Favatar%2Favatar.png"),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
