import type { Metadata } from "next";
import "@/shared/styles/globals.css";
import { Providers } from "@/shared/providers";

export const metadata: Metadata = {
  title: "LinkLynx - Discord Clone",
  description: "A real-time chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-discord-darkest text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
