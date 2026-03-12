"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/shared/model/stores/settings-store";

/**
 * Zustand の theme state を root theme class へ同期する。
 */
export function SettingsThemeBridge() {
  const resolvedTheme = useSettingsStore((state) => state.theme);
  const setResolvedTheme = useSettingsStore((state) => state.setTheme);
  const { theme, setTheme } = useTheme();
  const hasBootstrappedFromThemeRef = useRef(false);
  const skipNextThemeWriteRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedFromThemeRef.current) {
      return;
    }

    if (theme !== "light" && theme !== "dark") {
      return;
    }

    hasBootstrappedFromThemeRef.current = true;
    if (theme !== resolvedTheme) {
      skipNextThemeWriteRef.current = true;
      setResolvedTheme(theme);
    }
  }, [resolvedTheme, setResolvedTheme, theme]);

  useEffect(() => {
    if (!hasBootstrappedFromThemeRef.current) {
      return;
    }

    if (skipNextThemeWriteRef.current) {
      skipNextThemeWriteRef.current = false;
      return;
    }

    if (theme === resolvedTheme) {
      return;
    }

    setTheme(resolvedTheme);
  }, [resolvedTheme, setTheme, theme]);

  return null;
}
