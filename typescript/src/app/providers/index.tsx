"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/entities/auth";
import { AuthBridge } from "./auth-bridge";
import { SettingsThemeBridge } from "./settings-theme-bridge";
import { ThemeProvider } from "./theme-provider";
import { WsAuthBridge } from "./ws-auth-bridge";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AuthBridge />
          <SettingsThemeBridge />
          <WsAuthBridge />
          {children}
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
