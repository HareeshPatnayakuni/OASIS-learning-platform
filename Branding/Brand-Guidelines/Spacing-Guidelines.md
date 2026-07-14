# OASIS Spacing Guidelines

## 1. Clear Space

**Rule (from the Branding Package): maintain clear space around the logo
equal to the height of the "A" in the wordmark**, on all four sides, free
of any other text, graphics, or the edge of the container. This applies
to every lockup (Primary, Compact, Monochrome) and to the icon alone.

In practice: measure the cap-height of the "A" in whichever logo file is
in use, and keep at least that much empty margin around the entire logo
before any other element starts.

Why this matters: the icon mark (triangle + leaf + person + book) has
fine detail that needs breathing room to read clearly — crowding other
elements against it makes the mark look cluttered and can make the
person/book detail inside the triangle disappear at small sizes.

## 2. Minimum Size

Per the Branding Package's own specification:

| Context | Minimum size |
|---|---|
| Digital (web, app, screen) | **120px** wide (measuring the full lockup, not the icon alone) |
| Print | **25mm** wide |

**Below these sizes, use the icon alone** (`OASIS-Icon.png`) rather than
shrinking a full lockup past legibility — this is exactly why the icon
exists as its own separate, dedicated asset rather than being only
extractable from a larger lockup.

For the icon alone specifically (favicons, small badges), the practical
floor is 16×16px (the smallest favicon size actually shipped) — below
that, the icon's internal detail (the person silhouette inside the
triangle) stops being distinguishable and only the outer triangle shape
reads. This is expected and acceptable at 16×16 specifically (it's how
every browser tab favicon renders any detailed mark), but don't design a
new UI element that relies on reading the icon's internal detail below
32×32px.

## 3. Logo Placement Padding (Product Conventions)

These aren't from the Branding Package directly — they're the actual
spacing values already in use in the OASIS product's real components,
recorded here so future work stays consistent rather than picking new
arbitrary numbers:

| Location | Logo height | Surrounding padding |
|---|---|---|
| Navbar | 32px mobile / 36px desktop (`h-8`/`h-9`) | `px-4 py-3` container padding (16px horizontal / 12px vertical) |
| Footer | 28px (`h-7`) | `px-4 py-8` container padding (16px horizontal / 32px vertical), `mb-1` (4px) below the logo before the tagline |
| Auth pages (Login/Register/Forgot Password) | 40px (`h-10`) | Centered, `mb-6` (24px) below the logo before the page heading |
| Home page hero | Full-width up to `max-w-md` (28rem / 448px) | Centered, part of a `gap-4` (16px) vertical flex stack |

## 4. General UI Spacing Scale

The product uses Tailwind's default spacing scale throughout (4px
increments: `1`=4px, `2`=8px, `3`=12px, `4`=16px, `6`=24px, `8`=32px,
etc.) — there is no separate, brand-specific spacing scale. Component
padding, gaps, and margins should be chosen from this same scale for
consistency with every existing page, rather than introducing arbitrary
pixel values.

Common patterns already established:
- Card padding: `p-4` (16px)
- Section vertical spacing: `space-y-4` to `space-y-10` depending on
  hierarchy (form fields tight at `space-y-4`, dashboard sections looser
  at `space-y-8`–`space-y-10`)
- Page container: `max-w-6xl` (72rem / 1152px) for dashboards, `max-w-sm`
  (24rem / 384px) for auth forms, `max-w-2xl`–`max-w-5xl` for content-
  heavy single-column pages

## 5. Rounded Corners

Buttons, inputs, and cards consistently use `rounded-lg` (8px radius)
throughout the product; badges/pills use `rounded-full`. Don't introduce
a new radius value for a new component — reuse one of these two.
