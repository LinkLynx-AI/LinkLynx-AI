"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * アプリ全体の light/dark theme provider を提供する。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
