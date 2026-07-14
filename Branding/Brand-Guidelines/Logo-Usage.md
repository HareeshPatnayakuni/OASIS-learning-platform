# OASIS Logo Usage

## 1. Primary Logo

**File:** `Logos/OASIS-Logo-Light.png` (600×280px) and
`Logos/OASIS-Logo-Dark.png` (580×250px)

The full lockup: icon mark + "OASIS" wordmark + tagline ("Learn from
Home. Excel Everywhere.") + full name ("Online Academy for Smart
Integrated Studies"). This is the complete, formal version of the logo —
use it wherever there's room for the full lockup and the context is
formal/first-impression (a homepage hero, a certificate, the cover of a
brochure, an app's splash/onboarding screen).

- **Light** version: dark navy/full-color logo, for use on white or
  light backgrounds.
- **Dark** version: white/full-color logo, for use on Deep Navy or other
  dark backgrounds.

## 2. Secondary (Compact) Logo

**File:** `Logos/OASIS-Compact-Light.png` (585×180px) and
`Logos/OASIS-Compact-Dark.png` (480×157px)

Icon + "OASIS" wordmark only — no tagline, no full name. Use this
wherever space is constrained or the full lockup would be repetitive
(navigation bars, headers, footers, email headers, any place the brand
appears repeatedly across a single experience). This is what the OASIS
web product's own Navbar and Footer use.

- **Light**: for white/light backgrounds.
- **Dark**: for Deep Navy/dark backgrounds.

## 3. Monochrome Logo

**File:** `Logos/OASIS-Logo-Monochrome.png` (322×290px)

A single-color (black icon + black wordmark) version of the compact
lockup, for contexts where full color isn't available or appropriate —
single-color printing, watermarks, embossing, engraving (e.g. a
certificate's foil stamp), or any place a colored logo would clash with
surrounding content. **This specific file is a composition, not a single
direct crop — see §7.**

Additional monochrome and single-color variants (extracted individually,
not composed) are provided in `Logos/Extras/` for cases where only the
icon is needed in monochrome, or a specific shade (black/gray/navy) is
required:
- `OASIS-Icon-Monochrome-Dark.png` — icon only, solid black
- `OASIS-Icon-Monochrome-Light.png` — icon only, solid gray
- `OASIS-Icon-SingleColor-Navy.png` — icon only, solid Deep Navy
- `OASIS-Wordmark-Monochrome-Black.png` / `-Gray.png` — "OASIS" wordmark
  text alone, no icon

## 4. Icon Usage

**File:** `Logos/OASIS-Icon.png` (146×146px, square)

The icon mark alone (the triangle/leaf/person/open-book symbol,
representing learning, growth, and guidance) — no wordmark. Use this only
where the brand is already established elsewhere on the same screen, or
where space is too tight for any text at all: favicons, app icons,
loading spinners, a small badge/watermark, a social media avatar.

**Never use the icon alone as the first or only brand touchpoint in a new
context** (e.g. don't use just the icon on the cover of a brochure a
recipient has never seen before) — pair it with the wordmark (Compact or
Primary logo) whenever it's the first thing someone sees.

## 5. Light Background Usage

Use a **Light** variant (`OASIS-Logo-Light`, `OASIS-Compact-Light`) on:
white, Light Gray (`#F1F5F9`), or any background where the relative
luminance is closer to white than to Deep Navy. The wordmark in these
files is Deep Navy — do not place it on a mid-tone background where it
won't have sufficient contrast (see `Color-Palette.md §3`, the same
16.79:1 Deep Navy-on-white ratio applies to reading the logo itself).

## 6. Dark Background Usage

Use a **Dark** variant (`OASIS-Logo-Dark`, `OASIS-Compact-Dark`) on: Deep
Navy `#0B1D3A` (the primary dark surface used throughout the product,
e.g. the Footer) or any similarly dark background. The wordmark in these
files is white — the same logic applies in reverse: don't place it on a
mid-tone or light background where white won't read clearly.

**Do not attempt to place a Light-variant file on a dark background, or
vice versa** — the wordmark color won't have adequate contrast in either
mismatch. Pick the file made for the background it's going on.

## 7. Complete Asset Provenance

Every file, and exactly how it was produced. **Extraction** means a
pixel-boundary crop of the original uploaded Branding Package images with
zero alteration to the artwork itself. **Resize** means a mechanical
LANCZOS downscale/upscale of an already-extracted file — same image,
different pixel dimensions, still zero artistic alteration. **Composition**
means two or more already-extracted, unaltered pieces were placed
together in a new arrangement that does not exist as a single crop in the
source material — the pieces themselves are untouched, but their
combination is new.

| File | Type | Detail |
|---|---|---|
| `OASIS-Logo-Light.png` | Extraction | Direct crop, "Primary Logo" panel |
| `OASIS-Logo-Dark.png` | Extraction | Direct crop, "Logo on Dark" panel |
| `OASIS-Compact-Light.png` | Extraction | Direct crop, "Primary Logo" panel, tagline/sub-tagline cropped out |
| `OASIS-Compact-Dark.png` | Extraction | Direct crop, "Logo on Dark" panel, tagline/sub-tagline cropped out |
| `OASIS-Icon.png` | Extraction + padding | Direct crop, "Logo Mark (Symbol)" panel; **white canvas padding added on two sides to make it square** (146×146) — the artwork itself is untouched, only blank canvas was added around it |
| `OASIS-Logo-Monochrome.png` | **Composition** | `Extras/OASIS-Icon-Monochrome-Dark.png` + `Extras/OASIS-Wordmark-Monochrome-Black.png`, stacked vertically. Both pieces are real, unaltered extractions from the "Logo Variations" and "Monochrome / Single Color" panels respectively — but the two were never shown combined in the source material, so this specific arrangement was assembled, not cropped, from those two real pieces |
| `Extras/OASIS-Icon-Monochrome-Dark.png` | Extraction | Direct crop, "Logo Variations" panel, "Monochrome Dark" column |
| `Extras/OASIS-Icon-Monochrome-Light.png` | Extraction | Direct crop, "Logo Variations" panel, "Monochrome Light" column |
| `Extras/OASIS-Icon-SingleColor-Navy.png` | Extraction | Direct crop, "Logo Variations" panel, "Single Color" column |
| `Extras/OASIS-Wordmark-Monochrome-Black.png` / `-Gray.png` | Extraction | Direct crop, "Monochrome / Single Color" panel |
| `Favicons/favicon.ico`, `favicon-16.png`, `favicon-32.png` | Resize | LANCZOS-downscaled from `OASIS-Icon.png` |
| `Favicons/apple-touch-icon.png` (180×180), `android-192.png` (192×192), `android-512.png` (512×512) | Resize | LANCZOS-scaled from `OASIS-Icon.png` |
| `Social/Profile-Picture.png` (1024×1024) | Resize | `OASIS-Icon.png`, upscaled — not a new composition, just relabeled for its intended use (social platforms apply their own circular mask to a square source image) |
| `Social/Cover-Image.png` (1500×500), `Social/LinkedIn-Banner.png` (1584×396) | **Composition** | `OASIS-Logo-Dark.png` centered on a solid Deep Navy (`#0B1D3A`, exact) background, sized to each platform's required dimensions. Neither exists in the source material at these dimensions — both were composed for practical use, using only the real, unaltered logo file and the official exact brand color, never a new graphic element |

**Not available, at all, in any form:** `.svg` vector files for any
asset. See `Brand-Identity.md §2` for why, and what to do if real vector
source files become available later.

## 8. How Platform Settings Override This Package

The live OASIS product lets an Admin upload a custom logo and favicon via
Platform Settings (`PATCH /admin/settings`, `logoId`/`faviconId`). Every
place the logo appears in the product — Navbar, Footer, Login/Register/
Forgot Password, Home page, Open Graph/Twitter previews, browser favicon
— checks for an Admin-configured custom logo/favicon **first**, and only
falls back to this package's static files if none has been set:

```
settings?.logoUrl ?? '/brand/oasis-logo-....png'
settings?.faviconUrl ?? '/favicon.ico'
```

This means the files in this package are what a **fresh, unconfigured
install** shows — the permanent default identity, not a hardcoded
requirement. The same override-with-fallback pattern applies to academy
name, tagline, and contact details (all sourced from the same Platform
Settings, with this package's official values — "OASIS", "Online Academy
for Smart Integrated Studies", "Learn from Home. Excel Everywhere." — as
the fallback).

## 9. Do's and Don'ts

**Do:**
- Use the exact provided files, at their original aspect ratio.
- Choose the Light or Dark variant that matches the background it's
  going on (§5, §6).
- Maintain clear space around the logo (see `Spacing-Guidelines.md`).
- Use the monochrome/single-color variants for single-color print
  contexts (engraving, foil stamping, faxes, low-color printing).
- Use the Compact logo for repeated/small placements, the Primary logo
  for first-impression/formal placements.

**Don't:**
- Don't recolor, recolor-shift, or apply a filter/overlay to any logo
  file.
- Don't stretch or distort the aspect ratio — scale proportionally only.
- Don't rotate the logo.
- Don't place a Light variant on a dark background or a Dark variant on
  a light one.
- Don't add a drop shadow, outline, or glow to the logo.
- Don't recreate or hand-redraw the icon or wordmark in a new tool —
  always use the provided files.
- Don't crop the icon out of a lockup file to use alone — use the
  dedicated `OASIS-Icon.png` instead, which already has correct padding.
