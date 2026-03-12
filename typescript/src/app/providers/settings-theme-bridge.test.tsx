// @vitest-environment jsdom
import { act, render, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSettingsStore } from "@/shared/model/stores/settings-store";

const setThemeMock = vi.hoisted(() => vi.fn<(theme: string) => void>());
const useThemeMock = vi.hoisted(() =>
  vi.fn(() => ({
    theme: "dark",
    setTheme: setThemeMock,
  })),
);

vi.mock("next-themes", () => ({
  useTheme: useThemeMock,
}));

import { SettingsThemeBridge } from "./settings-theme-bridge";

describe("SettingsThemeBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      theme: "dark",
      compactMode: false,
      fontSize: 16,
      messageGroupSpacing: 16,
      showTimestamps: true,
      use24HourTime: false,
      enableReducedMotion: false,
      enableHighContrast: false,
    });
  });

  test("bootstraps the store from the persisted next-themes value", async () => {
    useThemeMock.mockReturnValue({
      theme: "light",
      setTheme: setThemeMock,
    });

    render(<SettingsThemeBridge />);

    await waitFor(() => {
      expect(useSettingsStore.getState().theme).toBe("light");
    });
    expect(setThemeMock).not.toHaveBeenCalled();
  });

  test("syncs the store theme into next-themes after bootstrap", async () => {
    useThemeMock.mockReturnValue({
      theme: "light",
      setTheme: setThemeMock,
    });

    render(<SettingsThemeBridge />);

    act(() => {
      useSettingsStore.setState({ theme: "dark" });
    });

    await waitFor(() => {
      expect(setThemeMock).toHaveBeenCalledWith("dark");
    });
  });
});
