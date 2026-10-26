import type { Metadata } from 'next'

// Search results cut a title at about 600px, roughly 60 characters. The root layout appends " | NextChapter" (14 characters)
// to every title that is a plain string, so a title only keeps the brand when the whole thing fits in 60. A longer title
// stands alone, with the keywords first, trimmed to 60 at a natural break rather than cut mid-word or ended with "…".

export const TITLE_LIMIT = 60
export const BRAND_SUFFIX = ' | NextChapter'

/** Trim to `max` characters at the last natural break (colon, comma, dash, then a word boundary). No ellipsis. */
export function trimTitle(text: string, max = TITLE_LIMIT): string {
  const t = text.replace(/\s+/g, ' ').replace(/\s+([,.:;])/g, '$1').trim()
  if (t.length <= max) return t
  const head = t.slice(0, max + 1)
  // The latest natural break that still fits.
  let best = -1
  for (const sep of [': ', ', ', ' – ', ' - ', ' and ', ' for ']) best = Math.max(best, head.lastIndexOf(sep))
  if (best >= 25) return head.slice(0, best).replace(/[,:;\s-]+$/, '')
  const cut = head.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp >= 25 ? cut.slice(0, sp) : cut).replace(/[,:;\s-]+$/, '')
}

/**
 * The `title` metadata for a page: the plain string (brand added by the layout) when it fits in 60 with the brand,
 * otherwise an absolute title of at most 60 characters with no brand.
 */
export function titleMeta(text: string): Metadata['title'] {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length + BRAND_SUFFIX.length <= TITLE_LIMIT) return t
  return { absolute: trimTitle(t) }
}

/** The text a title will show in results, brand included when it is shown: for tests and audits. */
export function renderedTitle(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length + BRAND_SUFFIX.length <= TITLE_LIMIT ? t + BRAND_SUFFIX : trimTitle(t)
}
