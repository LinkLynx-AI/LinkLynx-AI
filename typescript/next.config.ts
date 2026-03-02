import type { NextConfig } from "next";
import { parseFrontendEnv } from "./src/shared/config/env";

parseFrontendEnv(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
