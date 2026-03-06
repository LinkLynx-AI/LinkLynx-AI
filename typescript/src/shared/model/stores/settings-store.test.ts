import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "./settings-store";

describe("useSettingsStore", () => {
  beforeEach(() => {
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

  it("default theme is dark", () => {
    expect(useSettingsStore.getState().theme).toBe("dark");
  });

  it("setTheme updates theme", () => {
    useSettingsStore.getState().setTheme("light");
    expect(useSettingsStore.getState().theme).toBe("light");
  });

  it("setFontSize updates and clamps value", () => {
    useSettingsStore.getState().setFontSize(20);
    expect(useSettingsStore.getState().fontSize).toBe(20);

    useSettingsStore.getState().setFontSize(30);
    expect(useSettingsStore.getState().fontSize).toBe(24);

    useSettingsStore.getState().setFontSize(8);
    expect(useSettingsStore.getState().fontSize).toBe(12);
  });

  it("toggleCompactMode toggles", () => {
    expect(useSettingsStore.getState().compactMode).toBe(false);
    useSettingsStore.getState().toggleCompactMode();
    expect(useSettingsStore.getState().compactMode).toBe(true);
    useSettingsStore.getState().toggleCompactMode();
    expect(useSettingsStore.getState().compactMode).toBe(false);
  });

  it("setMessageGroupSpacing clamps value", () => {
    useSettingsStore.getState().setMessageGroupSpacing(10);
    expect(useSettingsStore.getState().messageGroupSpacing).toBe(10);

    useSettingsStore.getState().setMessageGroupSpacing(25);
    expect(useSettingsStore.getState().messageGroupSpacing).toBe(20);

    useSettingsStore.getState().setMessageGroupSpacing(-5);
    expect(useSettingsStore.getState().messageGroupSpacing).toBe(0);
  });

  it("toggleTimestamps toggles", () => {
    expect(useSettingsStore.getState().showTimestamps).toBe(true);
    useSettingsStore.getState().toggleTimestamps();
    expect(useSettingsStore.getState().showTimestamps).toBe(false);
  });

  it("toggleReducedMotion toggles", () => {
    expect(useSettingsStore.getState().enableReducedMotion).toBe(false);
    useSettingsStore.getState().toggleReducedMotion();
    expect(useSettingsStore.getState().enableReducedMotion).toBe(true);
  });
});
