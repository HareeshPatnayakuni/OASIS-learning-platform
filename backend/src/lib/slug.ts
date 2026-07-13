/** Converts a title into a URL-safe slug base — does not guarantee
 * uniqueness by itself; callers append a numeric suffix on collision (see
 * ensureUniqueSlug below). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Appends `-2`, `-3`, ... until `isTaken` reports the candidate is free.
 * `isTaken` is injected rather than this function querying Prisma
 * directly, so it stays reusable for both globally-unique slugs (Course)
 * and scoped-unique slugs (Chapter, unique per course, not globally —
 * docs/03-database-design.md §2.2).
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = baseSlug || 'untitled';
  let suffix = 2;
  while (await isTaken(candidate)) {
    candidate = `${baseSlug || 'untitled'}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
