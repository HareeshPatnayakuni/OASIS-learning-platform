import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `.next/standalone` output is ONLY needed for the optional self-hosted
  // Docker path (docker/frontend.Dockerfile) — the default V1 deployment
  // target is Vercel (docs/06-deployment-and-docker.md), which doesn't
  // need it. Gated behind DOCKER_BUILD rather than always on: it turns out
  // `output: "standalone"` and the ordinary `next start` (what a developer
  // runs locally to test a production build) are NOT compatible — Next
  // prints a warning and the server never actually starts serving requests
  // if standalone output is enabled. Docker's build sets DOCKER_BUILD=true
  // before `npm run build`; everyone else's build (local `npm start`,
  // Vercel) gets the normal, `next start`-compatible output.
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
};

export default nextConfig;
