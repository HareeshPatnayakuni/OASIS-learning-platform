# OASIS Color Palette

## 1. Official Colors (exact, from the Branding Package)

| Swatch | Name | Hex | RGB | Meaning (per Branding Package) |
|---|---|---|---|---|
| 🟦 | **Deep Navy** | `#0B1D3A` | 11, 29, 58 | Trust, Stability |
| 🔵 | **Bright Blue** | `#1E5BFF` | 30, 91, 255 | Learning, Clarity |
| 🟢 | **Fresh Green** | `#22C55E` | 34, 197, 94 | Growth, Success |
| 🔷 | **Teal** | `#14B8A6` | 20, 184, 166 | Balance, Focus |
| ⬜ | **Light Gray** | `#F1F5F9` | 241, 245, 249 | Clean, Neutral |

These five are never recolored, tinted, or substituted. Every other color
used anywhere in the product is derived from one of the first three
below (Deep Navy, Bright Blue, Fresh Green are the ones actually used as
UI accents; Teal is used sparingly as a gradient stop/secondary badge
tone, matching how the Branding Package itself uses it — never as a
primary UI color).

**Primary Gradient** (from the Branding Package, used in the icon mark):
Fresh Green `#22C55E` → Teal `#14B8A6` → Bright Blue `#1E5BFF`.

## 2. Derived UI Scale

A 5-swatch brand sheet doesn't itemize hover states, subtle backgrounds,
or disabled states — a real interface needs more steps than that. Every
shade below is a **mathematically derived tint (mixed toward white) or
shade (mixed toward Deep Navy)** of an official color, not a separately
invented one:

| Token | Hex | Derived from |
|---|---|---|
| `brand-50` | `#F2F5FF` | Bright Blue, tinted ~95% toward white |
| `brand-100` | `#E0E8FF` | Bright Blue, tinted ~88% toward white |
| `brand-400` | `#83A5FF` | Bright Blue, tinted ~50% toward white |
| `brand-500` | `#4B7CFF` | Bright Blue, tinted ~25% toward white |
| **`brand-600`** | **`#1E5BFF`** | **Bright Blue — official, exact** |
| `brand-700` | `#153FA6` | Bright Blue, shaded ~35% toward navy |
| **`brand-900`** | **`#0B1D3A`** | **Deep Navy — official, exact** |
| `accent-400` | `#85DFA6` | Fresh Green, tinted ~55% toward white |
| **`accent-500`** | **`#22C55E`** | **Fresh Green — official, exact** |
| `accent-600` | `#1DA750` | Fresh Green, shaded ~10% toward navy |
| `success-50` | `#EAFCF1` | Fresh Green, tinted ~95% toward white |
| `success-500` | `#22C55E` | Fresh Green — official, exact (same as accent-500; same color, different semantic name) |
| `success-600` | `#16803D` | Fresh Green, shaded further toward navy — **deliberately darker than accent-600**; see §3 |
| `teal-500` | `#14B8A6` | Teal — official, exact |

"Light Gray" (`#F1F5F9`) has no dedicated token — Tailwind's stock
`neutral-50`/`neutral-100` are close enough to be visually
indistinguishable and are already the app's neutral scale. Introducing a
second, parallel gray scale for a one-swatch difference would be
inconsistent with everything else in this palette being a genuine
derivation, not a new invention.

## 3. Accessibility — Computed Contrast Ratios

These are **computed** (standard WCAG relative-luminance formula), not
estimated. Use this table before choosing a color for text — don't
assume a color that works as a background also works as text on white,
or vice versa.

| Foreground | Background | Ratio | AA Normal Text (4.5:1) | AA Large Text / UI (3:1) |
|---|---|---|---|---|
| Deep Navy `#0B1D3A` | White | **16.79:1** | ✅ Pass | ✅ Pass |
| Bright Blue `#1E5BFF` | White | **5.26:1** | ✅ Pass | ✅ Pass |
| White | Deep Navy `#0B1D3A` | **16.79:1** | ✅ Pass | ✅ Pass |
| White | Bright Blue `#1E5BFF` | **5.26:1** | ✅ Pass | ✅ Pass |
| Fresh Green `#22C55E` | White | **2.28:1** | ❌ Fail | ❌ Fail |
| success-600 `#16803D` | White | **5.01:1** | ✅ Pass | ✅ Pass |
| accent-600 `#1DA750` | White | **3.14:1** | ❌ Fail | ✅ Pass |
| White | Fresh Green `#22C55E` | **2.28:1** | ❌ Fail | ❌ Fail |
| Deep Navy `#0B1D3A` | Fresh Green `#22C55E` | **7.37:1** | ✅ Pass | ✅ Pass |
| Teal `#14B8A6` | White | **2.49:1** | ❌ Fail | ❌ Fail |

**What this means in practice:**
- **Fresh Green and Teal must never be used as small/normal body text on
  a white or light background** — both fail even the relaxed large-text
  threshold. Use them for backgrounds, icons, borders, or large
  decorative headings only.
- **If text needs to convey a "success/positive" meaning, use
  `success-600` (`#16803D`), not the brighter `accent-500`/`accent-600`.**
  This is exactly why the product's design tokens have both: `accent-*`
  for buttons/backgrounds/icons where Fresh Green itself is the fill, and
  `success-600` specifically reserved for status-message *text*.
- **On a Fresh Green background, use Deep Navy text, not white** — Deep
  Navy on Fresh Green is a strong 7.37:1; white on Fresh Green fails at
  2.28:1.
- **Deep Navy and Bright Blue are both safe as text on white, and safe as
  a background under white text**, in either direction — these are the
  two colors to reach for whenever both roles (text and background) are
  needed at once (e.g. a filled button with white label).

## 4. Usage Across UI Elements

| Element | Color |
|---|---|
| Primary buttons (background) | Bright Blue `#1E5BFF` (brand-600) |
| Primary buttons (hover) | `#153FA6` (brand-700) |
| Accent / CTA buttons (background) | Fresh Green `#22C55E` (accent-500), Deep Navy text |
| Links | Bright Blue `#1E5BFF` |
| Success / positive status text | `#16803D` (success-600) — **not** raw Fresh Green |
| Success / positive backgrounds | `#EAFCF1` (success-50) |
| Headers / high-emphasis surfaces (e.g. Footer) | Deep Navy `#0B1D3A` |
| Card borders, table headers, neutral backgrounds | Tailwind stock `neutral-50`/`neutral-100` (standing in for Light Gray) |
| Decorative gradient (icon, hero accents) | Fresh Green → Teal → Bright Blue |

## 5. Where This Lives in Code

`frontend/src/app/globals.css`'s `:root` block is the single source of
truth in the actual product — every token above is defined there once
and consumed via Tailwind utility classes (`bg-brand-600`,
`text-accent-600`, etc.) everywhere else. Never hardcode a hex value or a
stock Tailwind color (`text-blue-600`, `bg-green-500`, etc.) directly in
a component — extend this token set (deriving from the same three
official colors) if a genuinely new shade is needed.
