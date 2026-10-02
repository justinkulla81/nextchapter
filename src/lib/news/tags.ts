/**
 * The topics a News item can be filed under. Any number per item.
 *
 * A fixed list rather than free text, so the public filter never grows a
 * second spelling of the same thing. Ordered the way a reader comes at a
 * search: what is happening, what to do about it, how it feels — the
 * hard parts, other people's accounts of them, and encouragement.
 */
export const NEWS_TAGS = [
  { key: 'news', label: 'News' },
  { key: 'data_research', label: 'Data and research' },
  { key: 'strategy', label: 'Job search strategy' },
  { key: 'tips', label: 'Tips and tricks' },
  { key: 'challenges', label: 'Job search challenges' },
  { key: 'stories', label: 'Stories' },
  { key: 'motivation', label: 'Motivation' },
] as const

export type NewsTagKey = (typeof NEWS_TAGS)[number]['key']

const KEYS = new Set<string>(NEWS_TAGS.map((t) => t.key))

/** Keeps only known tags, in list order — whatever a form or an old row hands in. */
export function cleanNewsTags(raw: readonly unknown[]): NewsTagKey[] {
  const given = new Set(raw.filter((r): r is string => typeof r === 'string' && KEYS.has(r)))
  return NEWS_TAGS.map((t) => t.key).filter((k) => given.has(k))
}

export function newsTagLabel(key: string): string {
  return NEWS_TAGS.find((t) => t.key === key)?.label ?? key
}
