/**
 * XPR story identity + item shape aligned with production precheck/ingest contracts.
 * `guid` must match between precheck, ingest, and story-status-check (not the canonical URL string).
 */

/** Raw path+query as used by older dashboard builds (status check only). */
export function legacyPathGuidRaw(link: string): string {
  const u = new URL(link)
  return u.pathname + (u.search || '')
}

/**
 * Stable story key: explicit > WordPress slug > last URL path segment (sanitized).
 */
export function deriveXprStoryGuid(
  link: string,
  slug?: string | null,
  explicitGuid?: string | null
): string {
  const g = explicitGuid?.trim()
  if (g) return g

  const s = slug?.trim()
  if (s) return s.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'story'

  try {
    const path = new URL(link).pathname.replace(/\/$/, '')
    const seg = path.split('/').filter(Boolean).pop() ?? 'story'
    return seg.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'story'
  } catch {
    return 'story'
  }
}

/** Default categories when none supplied (matches common Signal bulletin mix). */
export const XPR_DEFAULT_CATEGORIES = [
  'Legal',
  'Press Releases',
  'Business',
  'Investor Risk',
] as const
