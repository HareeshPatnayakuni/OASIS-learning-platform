import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables `.next/standalone` output, which docker/frontend.Dockerfile
  // depends on for the optional self-hosted deployment path (the default
  // V1 target is Vercel, which doesn't need this — see
  // docs/06-deployment-and-docker.md). Harmless to leave on either way.
  output: "standalone",
};

export default nextConfig;
