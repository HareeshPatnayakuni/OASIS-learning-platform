# OASIS Brand Identity

**This is the permanent, single source of truth for OASIS branding.**
Everything in this `Branding/` package supersedes any earlier ad hoc
branding decisions made before it existed. Any future product — website,
mobile app, brochure, certificate, social post, banner — should be built
from these files and rules, not from memory or a previous screenshot.

---

## 1. Official Identity

| | |
|---|---|
| **Official Name** | OASIS |
| **Full Form** | Online Academy for Smart Integrated Studies |
| **Official Tagline** | Learn from Home. Excel Everywhere. |

**Exact capitalization matters.** The tagline is "Learn from Home. Excel
Everywhere." — lowercase "from," capital "Learn" and "Excel." Earlier
inconsistent capitalization ("Learn From Home") was found and corrected
across the codebase during Module 3D; don't reintroduce it.

The Full Form is a formal/SEO-facing string (page titles, legal/contact
contexts). The Official Name ("OASIS") is what's shown in compact UI
(Navbar, app icon label, favicon tab title truncation).

## 2. Where This Package Came From

The source material was two composite brand-guideline board images
(`All_variations_of_final_logo.png`, `Polished_Logo.png`), a color
reference (`Brand_Summary.docx` / `colors.txt`), and this document's own
governance instructions. **Every visual asset in `Logos/`, `Favicons/`,
and the icon used in `Social/` is either a direct pixel-boundary
extraction from those two board images, or a mechanical resize/composition
built from one — never a redrawn, recolored, or reinterpreted version of
the mark.** See `Logo-Usage.md §7` for the exact provenance of every
single file, including which ones are compositions rather than direct
crops.

**What was never supplied, and is not included:** vector (`.svg`) source
files. The uploaded boards were flat raster (PNG) composites; no vector
artwork was ever provided. Auto-tracing a raster image into a vector was
considered and deliberately not done — it would either misrepresent the
mark's actual gradient fill (vector auto-tracers handle flat colors, not
smooth gradients, well) or require redrawing, both of which risk exactly
the kind of unfaithful reproduction this package exists to prevent. If
true vector source files become available later, they are a drop-in
replacement at the same filenames with a `.svg` extension added
alongside the `.png` — nothing else in this package or the product
codebase needs to change to accommodate them.

## 3. What's in This Package

```
Branding/
├── Logos/                    Primary, secondary, monochrome, and icon-only logo files
│   └── Extras/                Additional real monochrome/single-color variants (bonus, not in the original request)
├── Favicons/                  Browser tab, home-screen, and PWA icons at every required size
├── Social/                    Profile picture, cover image, LinkedIn banner
└── Brand-Guidelines/          This document and four companion guides:
    ├── Brand-Identity.md       (this file)
    ├── Color-Palette.md        Official colors, derived shades, contrast/accessibility data
    ├── Typography.md           Official typefaces, weights, usage rules
    ├── Logo-Usage.md           Primary/secondary logo, icon usage, do's and don'ts, full asset provenance
    └── Spacing-Guidelines.md   Minimum size and clear-space rules
```

## 4. Where This Is Already Applied

As of Module 3D, this branding is live across the OASIS platform:
Navbar, Footer, Home page, Login/Register/Forgot Password, browser tab
title, favicon, PWA manifest, Open Graph/Twitter Card previews, and
transactional emails (verification, password reset). Platform Settings
(the Admin-configurable academy name/tagline/logo/favicon/contact info)
takes priority over these static defaults wherever an Admin has uploaded
custom branding — see `Logo-Usage.md §8` for exactly how that override
works. This package is what a fresh, unconfigured install shows, and what
every future product (mobile app, brochures, certificates) should start
from.
