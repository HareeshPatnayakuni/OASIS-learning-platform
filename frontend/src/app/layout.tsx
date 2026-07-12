import type { Metadata } from "next";
import "./globals.css";

/**
 * Deliberately using a system font stack (configured in globals.css via
 * `--font-sans`/`--font-mono`, see @theme inline below) rather than
 * `next/font/google`. Two reasons, not just "it happened to fail in this
 * sandbox":
 *   1. No build-time (or runtime) dependency on Google's font CDN — one
 *      less external network call, and one less third-party origin serving
 *      content to end users, which is relevant given docs/01's NFR-COMP
 *      notes on being deliberate about third-party data flows for a
 *      platform whose users are largely minors.
 *   2. System fonts render instantly with zero layout shift and no
 *      download at all. If a specific brand typeface is wanted later, it's
 *      a self-hosted `next/font/local` addition — a small, contained change.
 */
export const metadata: Metadata = {
  title: {
    default: "OASIS — Online Academy for Smart Integrated Studies",
    template: "%s | OASIS",
  },
  description: "Learn From Home. Excel Everywhere.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
