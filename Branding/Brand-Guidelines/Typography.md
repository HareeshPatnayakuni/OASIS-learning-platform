# OASIS Typography

## 1. Official Typefaces

| Role | Typeface | Per the Branding Package |
|---|---|---|
| **Headings** | **Poppins** | "Primary Font (Headings)" |
| **Body text** | **Inter** | "Secondary Font (Body)" |

Both are geometric/humanist sans-serif faces that pair cleanly — Poppins
for its distinctive geometric character in headings, Inter for its high
legibility in body copy at small sizes.

## 2. How This Is Implemented

Self-hosted via `@fontsource/poppins` and `@fontsource/inter` (real WOFF2
font files shipped as npm package assets), imported in
`frontend/src/app/globals.css`, applied via CSS custom properties:

- `--font-heading` → Poppins (falls through to the system sans-serif
  stack if Poppins fails to load)
- `--font-sans` → Inter (same fallback behavior)

`h1`–`h6` use `--font-heading` **automatically**, applied once globally
— no component needs a special class to get Poppins on its headings.
`body` uses `--font-sans` (Inter) by default for everything else.

**Why self-hosted, not `next/font/google`:** fetching fonts directly from
Google's font CDN at build time failed in the actual deployment/dev
environment this was built in (no network path to
`fonts.googleapis.com`). `@fontsource` resolves the exact same font files
from the npm registry instead, which is reachable — and is arguably the
better choice regardless, since the font files ship with the app rather
than being fetched from a third-party origin at all.

## 3. Weights in Use

| Typeface | Weights installed | Typical use |
|---|---|---|
| Poppins | 400, 500, 600, 700 | 600–700 for `h1`/`h2`, 500–600 for `h3`–`h6` |
| Inter | 400, 500, 600 | 400 for body copy, 500–600 for emphasis/labels/buttons |

Don't reach for a weight that isn't installed (e.g. Poppins 300 or 800) —
add it to the `@fontsource` imports in `globals.css` first if a genuine
new need arises, rather than letting the browser fake-bold/fake-light a
weight that doesn't exist, which looks visibly different from the real
thing.

## 4. Sizing & Hierarchy

The product doesn't use a bespoke type scale — it uses Tailwind's
standard text-size utilities (`text-sm`, `text-base`, `text-lg`,
`text-xl`, `text-2xl`, etc.) directly, combined with the automatic
Poppins-for-headings rule above. Practical hierarchy already in use
across the app:

| Usage | Classes |
|---|---|
| Page title (`h1`) | `text-2xl font-semibold` to `text-4xl font-bold` depending on context (dashboard headers are smaller than marketing/hero headings) |
| Section heading | `text-lg font-semibold` |
| Small section label (uppercase eyebrow) | `text-sm font-semibold tracking-wide uppercase text-neutral-500` |
| Body text | `text-sm` or default (no class), Inter, `text-neutral-600`/`700`/`900` depending on emphasis |
| Caption / metadata | `text-xs text-neutral-400`/`500` |

Don't invent a new heading size or weight combination for a one-off
page — reuse one of the patterns already established across the
Student/Teacher/Admin dashboards.

## 5. Letter Spacing

The wordmark and brand name use tight tracking (`tracking-tight`) in the
Navbar and page headings for a denser, more logo-like feel, matching how
"OASIS" is set in the actual logo artwork. Small uppercase labels use
the opposite — slightly loosened tracking (`tracking-wide`) — which is
standard practice for small-caps-style eyebrow text and is not brand-specific.
