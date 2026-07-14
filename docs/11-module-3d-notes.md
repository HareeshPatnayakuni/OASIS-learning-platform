# Module 3D — Implementation Notes
## Branding & UI Identity

Continues the per-module documentation pattern from `docs/07`–`docs/10`.
This module touches **only** presentation — colors, typography, dynamic
branding text, metadata, and one new UI-chrome component (Footer). No
backend logic, database schema, API contract, or business rule changed —
see §5 for exactly what confirms that.

---

## 1. What was provided vs. what was actually usable

The uploaded Branding Package (`All_variations_of_final_logo.png`,
`Polished_Logo.png`, `colors.txt`, `Brand_Summary.docx`) is a pair of
**brand guideline boards** — comprehensive reference sheets showing the
logo in context (primary/dark/light lockups, app icon variants, favicon
set, usage examples, file-format callouts) — not the individual, isolated
production asset files those boards themselves list as deliverables.
`colors.txt` says so directly: *"Place these files in Final Logo once
available,"* naming `oasis-logo-primary.svg`, `oasis-icon.svg`,
`favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` as a pending,
separate delivery that was never actually included.

**What was fully specified and unambiguous, applied directly:**
- Exact colors (5 hex values, `Brand_Summary.docx`)
- Exact typography (Poppins for headings, Inter for body)
- Exact wordmark text ("OASIS"), full name ("Online Academy for Smart
  Integrated Studies"), and tagline ("Learn from Home. Excel Everywhere.")

**The logo image itself** — a first pass through this module judged
attempting to isolate it from the composite boards too risky (guessing
crop boundaries, or baking in whichever section's background color it
came from) and left it as an open gap, pointing the favicon/manifest/
Navbar at generic placeholders in the meantime. That conclusion was
revisited: rather than guessing boundaries by eye, the actual pixel data
was analyzed programmatically — scanning rows/columns of each candidate
region for where non-background ("ink") pixels start and stop, so every
crop boundary is the real, measured edge of the artwork, not an estimate.
Verified after every crop that all four edges have **zero** stray content
(confirmed by re-scanning the finished crop's own border pixels), so
nothing is clipped and nothing extraneous (panel labels, divider lines,
neighboring panels) leaked in. This is mechanical extraction of pixels
that already exist in the provided file — no redrawing, no recoloring, no
alternate interpretation of the mark — the same operation as opening the
file in an image editor, drawing a selection rectangle around the already
correctly-colored artwork, and exporting it. Five assets were extracted
this way: the full lockup (icon + wordmark + tagline + sub-tagline) on
both light and dark backgrounds, a compact icon+wordmark (no tagline) on
both backgrounds, and the icon mark alone (padded to a square, not
stretched or distorted) for the favicon/app-icon family. Real favicon
files were then generated from that icon-only crop at every standard
size (16/32/48/180/192/512px) using standard LANCZOS downsampling — the
normal, expected step for producing a favicon set from any source image,
not a redesign of the mark itself.

See §8 for exactly which files this produced and where they're used.

## 2. What was changed

**Colors** (`frontend/src/app/globals.css`) — the placeholder indigo/amber
palette from Module 3A is replaced with the official palette. Two of the
five brand colors anchor the existing shade scale exactly
(`brand-600` = Bright Blue `#1E5BFF`, `brand-900` = Deep Navy `#0B1D3A`,
`accent-500` = Fresh Green `#22C55E`); every other shade in the ramp
(`brand-50/100/400/500/700`, `accent-400/600`) is a **mathematically
derived** tint/shade of those exact colors (simple linear mix toward
white or toward navy), not a separately invented color — necessary
because a 5-swatch brand sheet doesn't itemize hover states or subtle
backgrounds, but nothing here recolors the three colors that *are*
specified. Teal (`#14B8A6`) is kept as `--color-teal-500` for occasional
use, matching how the brand board itself uses it (one stop in a gradient,
not a primary UI color). "Light Gray" (`#F1F5F9`) isn't a separate token —
Tailwind's stock `neutral-50/100`, already used everywhere since Module
3A, is close enough to be visually indistinguishable, and introducing a
parallel gray scale for a one-swatch difference would itself be exactly
the kind of redesign this module isn't meant to do.

**Typography** — Poppins (headings) + Inter (body), self-hosted via
`@fontsource/poppins`/`@fontsource/inter` (real WOFF2 font files as npm
package assets), imported in `globals.css`, applied globally to
`h1`–`h6`. `next/font/google` was tried first and hard-fails in this
sandbox — a live build attempt got a 403 fetching
`fonts.googleapis.com` (no network path to Google's font CDN here — see
the raw error captured in this session). `@fontsource` sidesteps this
entirely: the font files are resolved from the npm registry (which *is*
reachable) rather than fetched from Google at build or runtime, which is
also a strictly better fit for the reasoning that originally kept this
project on system fonts (avoiding a third-party origin serving content to
end users) — this is genuinely self-hosted, not merely build-time-cached
from one.

**Dynamic branding text** — Navbar (already fixed in Module 3C), Login
and Register page copy ("Welcome back to {academy}", "New to {academy}?",
"Start learning with {academy} today") now read from the same public
`GET /settings` the rest of the app uses, rather than a hardcoded
"OASIS." Root layout metadata gained Open Graph and Twitter Card fields
(title/description/site name, image — the real extracted logo by default,
an Admin-uploaded one taking priority when set) and a `viewport` export
setting `theme-color` to the official Deep Navy. A new `manifest.ts`
(didn't exist before) provides `name`/`short_name` dynamically and sets
`theme_color`/`background_color` to the brand values, with real,
extracted PNG icons (see §8) rather than the generic Next.js default.
`metadataBase` was also added (a real Next.js build warning, not
something invented to add) so these image URLs resolve against the
actual site origin rather than always defaulting to localhost.

**New component: Footer** — mounted once in the root layout (mirroring
how `PlatformAnnouncementsBanner` mounts once, Module 3C), showing
academy name/tagline/contact email/phone/social links, all from
`GET /settings`. This wasn't a pre-existing page needing branding
applied — the module's own checklist lists "Footer" alongside pages that
do already exist, and a footer that only ever displays already-available
Settings data (no new business capability) reads as completing the
branding-application task the checklist asks for, not a new feature.

**The actual logo image** now appears in the Navbar, Footer, Home page
hero, and all three auth pages (Login/Register/Forgot Password) — see §8
for the full asset inventory and exactly which crop goes where. `favicon.ico`
and the manifest's PWA icons are the real extracted mark, not the
Next.js/generic placeholders they were before.

**Emails** (`backend/src/lib/email.ts`) — verification and password-reset
templates now use the official tagline and brand colors (Deep Navy header,
Bright Blue buttons/links) in place of the previous plain, unbranded
HTML. See §5 for why these use the *literal* confirmed brand values
rather than a live Settings fetch.

## 3. Real bugs / inconsistencies found during the review pass

Three genuine issues, not hypothetical — found by actually grepping the
codebase for color/text usage rather than assuming the design system was
already perfectly consistent:

1. **A stray Tailwind stock color bypassing the brand tokens.** The
   placeholder Home page's tagline used `text-blue-600` (Tailwind's stock
   blue, a visibly different hex from the official Bright Blue) instead
   of `text-brand-600`. Fixed.
2. **Tagline capitalization was inconsistent across the codebase** —
   some places had "Learn From Home" (capital F), others "Learn from
   Home" (lowercase, matching the official Branding Package exactly).
   Fixed everywhere it represented real content: `database/seed.ts`
   (the actual seeded `AcademySettings.tagline` value), the Home page's
   fallback constant, and `README.md`. Left one occurrence alone — a
   Module 3C test fixture (`settings.service.test.ts`) that's just
   round-tripping an arbitrary string through `updateSettings`, not
   asserting anything about the official tagline; "fixing" its
   capitalization wouldn't change what it verifies.
3. **A real accessibility shortfall, caught by actually computing
   contrast ratios rather than eyeballing the palette.** Fresh Green
   (`#22C55E`) is exact and correct for buttons/backgrounds, but the
   *text* color derived from it for status messages and an (unused but
   present) Badge tone — `#1DA750` — only reaches 3.14:1 against white,
   below WCAG AA's 4.5:1 minimum for normal-sized text. Computed a
   further-darkened shade (`#16803D`, verified at 5.01:1 using the
   standard relative-luminance formula) and used it specifically for
   `--color-success-600` (text usage), while leaving the lighter shade
   for button-background contexts where the actual contrast partner
   (brand-900 or white *on top of* the color, not the color itself as
   text) is already well above threshold. Also added a proper
   `--color-success-50` tint instead of the six places that were relying
   on Tailwind's stock `green-50` happening to look right.
4. **The generated `favicon.ico` failed the production build outright**
   the first time: Next.js's image processor requires the PNG frames
   embedded inside an `.ico` to be RGBA (with an alpha channel);
   generating it from a plain RGB image produced an ICO that decoded fine
   with plain image tools but failed Next's stricter Turbopack decoder
   with `"The PNG is not in RGBA format!"` at build time. Caught by
   actually running `npm run build`, not just eyeballing the file. Fixed
   by converting to RGBA before the `.ico` save; re-verified the fixed
   file reports all three embedded sizes (16/32/48) and that the full
   production build succeeds.
5. **Two cropping mistakes, caught by you reviewing the actual delivered
   files, not by any check performed here.** Both were real errors, not
   false alarms:
   - The compact icon+wordmark (light) crop clipped the wordmark —
     boundary detection correctly measured the true right edge at column
     630, but the crop command that followed used 500 instead, cutting
     "OASIS" down to "OAS". A transcription mistake between measuring the
     boundary and applying it, not a flaw in the measurement method
     itself.
   - The icon-only crop still included the brand board's own section
     header text ("LOGO MARK (SYMBOL)") above the icon — the caption
     *below* the icon had been correctly identified and excluded, but the
     equivalent label *above* it was visible in this file's own
     first-pass preview and wasn't acted on.
   Both re-cropped using the same boundary-detection method, this time
   re-verifying all four edges of each final crop are ink-free before
   accepting it (rather than trusting the first attempt) — see §8 for the
   corrected files. Every other extracted asset (both full lockups, the
   dark-background compact lockup) was independently re-checked against
   the same standard while fixing these two, and confirmed already
   correct.

## 4. UI consistency review

Checked every page for stray hardcoded colors (`grep` across all `.tsx`
files for stock Tailwind blue/indigo/green classes and any raw hex
values or inline `style` color overrides) — found and fixed the three
items in §3, nothing else. This confirms the design-system investment
from Modules 3A–3C is paying for itself: because every page already
routes through the shared `Button`/`Badge`/`ProgressBar`/`Spinner`/
`EmptyState`/`ErrorState` components and the `brand-*`/`accent-*`/
`success-*`/`neutral-*` token classes rather than one-off styling, most
of the ~30 pages in the app picked up the entire rebrand automatically
the moment `globals.css`'s tokens were updated — they needed zero direct
edits. Spacing, button variants, card styling, and icon stroke-width
conventions were already consistent going in; this module didn't find a
reason to touch them.

## 5. Confirming no backend logic/schema/API/business-rule changes

The one backend file touched is `lib/email.ts`, and only its two
**template functions'** literal string/HTML content — not
`auth.service.ts`, not the repository layer, not any route, not the
`AcademySettings` schema. Specifically NOT done, on purpose: having
`auth.service.ts` fetch `AcademySettings` before building an email, which
would have been a real control-flow change (a new async dependency, a
new failure mode) in a module explicitly told not to touch backend logic.
The two email functions still take exactly the same parameters, return
the same `EmailMessage` shape, and are called from exactly the same
places, the same way, with the same fallback-to-console-transport
behavior — confirmed by running the full, frozen `auth.service.test.ts`
suite unmodified: all 55 tests still pass, including the ones that
recover the raw verification/reset token by regex-matching it out of the
live (not mocked) email text — proof the URL-embedding behavior is
byte-for-byte unchanged, only the surrounding copy and styling around it.

No `.prisma` schema file was touched. No route, controller, service, or
repository changed. No new endpoint was added. `requireRole`/RBAC is
untouched. The full backend test suite (238 tests, unchanged from Module
3C) passes without a single modification to any test's expectations.

## 6. Testing

Backend: all 238 tests pass, unmodified from Module 3C (no backend logic
changed, so no reason for any test to need updating — confirmed rather
than assumed, by actually running the suite after the email template
edit). `tsc`/lint clean.

Frontend: full production build succeeds, including the newly-added
`@fontsource` imports (verified the compiled CSS actually contains the
real `@font-face` rules for both typefaces at every imported weight, not
just that the build didn't error), the new `manifest.ts` route, and the
real favicon/icon files (including recovering from the RGBA build failure
in §3, item 4). Live-booted the frontend and, rather than trusting the
build alone, `curl`'d the rendered HTML of the Home and Login pages and
confirmed the actual `<img>` tags present point at the real extracted
files with correct `alt` text, then separately requested every one of
those asset paths directly and confirmed each returns `200` (not a silent
404 that Turbopack's build wouldn't necessarily catch) — same for
`/favicon.ico` and `/manifest.webmanifest`, the latter confirmed to
return the correct dynamic `name`/`short_name`/`theme_color` plus the new
icon entries. Lint clean.

## 7. Known gaps / deferred

- **No frontend component/hook tests**, consistent with every prior
  module's documented gap.
- **Social links in the Footer/Settings UI only render Instagram/
  YouTube/Facebook/Twitter/LinkedIn labels** (Module 3C's existing
  limitation, unchanged) — the underlying data is a free-form
  `Record<string, string>`, so any other key still renders, just with
  its raw key text as the label instead of a friendly name.
- **The extracted assets are PNG only, not SVG.** The Branding Package
  names `.svg` deliverables (`oasis-logo-primary.svg`, `oasis-icon.svg`)
  that were never actually supplied — only the two composite PNG boards
  were. A crop of a raster board can only ever produce a raster output;
  it can't manufacture a vector file that isn't there. The PNGs used
  throughout are exported at resolutions well above their largest
  on-screen usage (e.g. the 512px app icon, the ~600px-wide hero image),
  so this isn't a visible quality problem — but if real vector source
  files are supplied later, swapping them in is a drop-in replacement at
  the same paths under `frontend/public/brand/`.

## 8. Extracted brand assets — inventory and usage

All under `frontend/public/brand/`, plus `frontend/src/app/favicon.ico`.
Every one is a direct crop of the uploaded
`All_variations_of_final_logo.png` — no pixel was redrawn, recolored, or
regenerated; see §1 for the extraction method.

| File | Extracted from | Used in |
|---|---|---|
| `oasis-logo-icon-wordmark-light.png` | "Primary Logo" panel, icon+wordmark only (tagline cropped out) | Navbar, Login/Register/Forgot-password header |
| `oasis-logo-full-light.png` | "Primary Logo" panel, full lockup incl. tagline + sub-tagline | Home page hero |
| `oasis-logo-icon-wordmark-dark.png` | "Logo on Dark" panel, icon+wordmark only | Footer |
| `oasis-logo-full-dark.png` | "Logo on Dark" panel, full lockup | Available for any future dark-surface use; not currently mounted anywhere |
| `oasis-icon.png` | "Logo Mark (Symbol)" panel, icon alone, padded to a square (not stretched) | Source for the favicon/app-icon set below |
| `favicon.ico` | Resized from `oasis-icon.png` | Browser tab icon (16/32/48px, multi-resolution, RGBA) |
| `brand/apple-touch-icon.png` | Resized from `oasis-icon.png`, 180×180 | `generateMetadata()`'s `icons.apple` |
| `brand/icon-192.png`, `brand/icon-512.png` | Resized from `oasis-icon.png` | `manifest.ts`'s PWA icon set |

Every image tag using these has an **unconditional fallback pattern**:
`settings?.logoUrl ?? '/brand/oasis-logo-....png'` — if an Admin uploads a
custom logo via Platform Settings (Module 3B/3C's existing
`POST /media` + `PATCH /admin/settings` flow), that takes priority
everywhere automatically; these files are what renders on a fresh
install where no admin has uploaded one yet. This is the same
dynamic-with-a-real-default pattern already established for the favicon
in `generateMetadata()`.

---

## 9. Pre-freeze verification pass

Before freezing, four items were verified against the actual code and
live requests — not assumed:

| # | Item | Result |
|---|---|---|
| 1 | Every page uses official branding consistently, no placeholder branding anywhere | ✅ Verified by grepping the entire frontend for stock Tailwind colors (`text-blue-*`, `bg-indigo-*`, etc.) and raw hex values — zero matches outside one intentional, correctly-used `BRAND_NAVY` constant. Grepped for hardcoded "OASIS"/tagline text bypassing Platform Settings — zero matches outside fallback constants and code comments. Live-confirmed the logo renders (via Navbar/Footer, inherited from the root layout) on every page including the 404 page, which correctly returns HTTP 404 while still showing the real logo. |
| 2 | Browser title, favicon, manifest, OG metadata, email templates, Navbar, Footer, and auth pages all use official branding | ✅ Verified live: `curl`'d the manifest (correct dynamic name/short_name/theme_color/icons), the homepage's OG and Twitter Card tags (correct title/description/site name/image), and the theme-color meta tag (`#0B1D3A`, exact). Email templates re-confirmed unchanged and correct from the earlier pass. |
| 3 | Platform Settings override the defaults wherever applicable, with correct fallback | ✅ Verified by grepping every one of the 8 `logoUrl` usage sites and the 1 `faviconUrl` usage site in the frontend — all consistently use `settings?.X ?? '/brand/...'`/`'/favicon.ico'`, never a bare static path and never a bare dynamic one with no fallback. |
| 4 | No backend business logic, schema, API, or architecture was modified | ✅ Verified two ways: the full 238-test backend suite passes unmodified, and a file-modification-time comparison across every backend `.ts` file shows `lib/email.ts` as the single most recently touched file, with a clear ~63-minute gap before the next-most-recent (a Module 3C file) — confirming nothing else in the backend was touched during this module's work. |

No corrections were needed for any of the four items.

## 10. Master Branding Package

Per your request, a permanent `Branding/` package now lives at the
repository root (`Branding/`, alongside `backend/`, `frontend/`,
`docs/`) — the single source of truth for all future OASIS branding
(web, mobile app, brochures, certificates, social media, banners).
Structure, full asset provenance (which files are direct crops vs.
mechanical resizes vs. disclosed compositions), and all five guideline
documents (Brand Identity, Color Palette, Typography, Logo Usage,
Spacing Guidelines) are in `Branding/README.md` and
`Branding/Brand-Guidelines/`.

Two categories of new work went into this package beyond what Module 3D
had already produced:

- **Three additional real extractions**, found and pulled from the
  source boards using the same pixel-boundary-detection method as
  everything else: monochrome icon variants (dark/light) and a
  single-color (Deep Navy) icon variant, from the boards' own "Logo
  Variations" panel, plus a monochrome "OASIS" wordmark (black and gray)
  from the "Monochrome / Single Color" panel. None of these were part of
  the original Module 3D asset set — they exist in the source material
  but weren't needed until this package's fuller `Logo-Usage.md`
  requirements (Do's/Don'ts, monochrome usage) called for them.
- **Three disclosed compositions**: `OASIS-Logo-Monochrome.png` (the
  monochrome icon + monochrome wordmark, stacked — these two pieces are
  never shown combined in the source, so this arrangement was assembled,
  not cropped), and `Social/Cover-Image.png` /
  `Social/LinkedIn-Banner.png` (the real dark-variant logo centered on a
  solid, exact Deep Navy background, sized to each platform's actual
  required dimensions — neither exists in the source material at these
  dimensions). Every composition is explicitly labeled as such in
  `Logo-Usage.md §7`, distinct from the direct extractions.

Also caught during this pass: the same rigorous "verify all four crop
edges are ink-free, and re-verify with a wider search window" discipline
was applied to every new extraction here, specifically *because* two
earlier Module 3D crops (the compact-light logo and the icon-only file)
had been found to be flawed on review — see the entry in `CHANGELOG.md`
for that correction. No new flaws were found in this pass, but the
extra verification step was deliberate, not assumed to be unnecessary
this time.

---

## Module 3D: FROZEN

Per your instruction, Module 3D — official brand palette, typography,
the real extracted logo across the Navbar/Footer/Home/auth pages/favicon/
manifest, dynamic Platform-Settings-driven branding with correct
fallback, branded emails, and the permanent Master Branding Package — is
now permanent, alongside Modules 1, 2, 3A, 3B, and 3C. Confirmed zero
backend logic, schema, API, or architecture changes throughout.

## 11. Quick reference

```bash
# Backend
cd backend && npm run dev          # http://localhost:4000

# Frontend (separate terminal)
cd frontend && npm run dev         # http://localhost:3000

npm test        # backend: 238 tests (unchanged)
npm run lint    # both packages
npm run build   # both packages
```
