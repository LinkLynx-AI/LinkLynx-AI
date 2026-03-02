import type { NextConfig } from "next";
import { parseFrontendEnv } from "./src/shared/config/env";

parseFrontendEnv(process.env, "build-time frontend");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
