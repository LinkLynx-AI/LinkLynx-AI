// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { SettingsRouteShell } from "./settings-route-shell";

const replaceMock = vi.hoisted(() => vi.fn());
const usePathnameMock = vi.hoisted(() => vi.fn());
const useSearchParamsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: useSearchParamsMock,
}));

describe("SettingsRouteShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/settings/profile");
    useSearchParamsMock.mockReturnValue(new URLSearchParams("returnTo=/channels/2001/3001"));
  });

  test("preserves returnTo in settings navigation links", () => {
    render(
      <SettingsRouteShell>
        <div>content</div>
      </SettingsRouteShell>,
    );

    const desktopNav = screen.getByRole("navigation", { name: "設定サイドバー" });
    expect(within(desktopNav).getByRole("link", { name: "外観" }).getAttribute("href")).toBe(
      "/settings/appearance?returnTo=%2Fchannels%2F2001%2F3001",
    );
  });

  test("close button returns to normalized returnTo route", async () => {
    render(
      <SettingsRouteShell>
        <div>content</div>
      </SettingsRouteShell>,
    );

    const closeButton = screen.getAllByRole("button", { name: "設定を閉じる" })[0];
    if (closeButton === undefined) {
      throw new Error("close button not found");
    }

    await userEvent.click(closeButton);

    expect(replaceMock).toHaveBeenCalledWith("/channels/2001/3001");
  });

  test("escape key returns to current returnTo route", () => {
    render(
      <SettingsRouteShell>
        <div>content</div>
      </SettingsRouteShell>,
    );

    expect(screen.getByText("content")).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(replaceMock).toHaveBeenCalledWith("/channels/2001/3001");
  });

  test("falls back to channels me when returnTo is invalid", async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("returnTo=https://example.com"));
    render(
      <SettingsRouteShell>
        <div>content</div>
      </SettingsRouteShell>,
    );

    const mobileNav = screen.getByRole("navigation", { name: "設定メニュー" });
    expect(within(mobileNav).getByRole("link", { name: "外観" }).getAttribute("href")).toBe(
      "/settings/appearance",
    );

    const closeButton = screen.getAllByRole("button", { name: "設定を閉じる" })[0];
    if (closeButton === undefined) {
      throw new Error("close button not found");
    }

    await userEvent.click(closeButton);

    expect(replaceMock).toHaveBeenCalledWith("/channels/me");
  });
});
