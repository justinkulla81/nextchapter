// Podcasts, newsletters and publications a leader in each function follows. Pure data and lookups, no I/O.
// The list itself is hand-curated in media-data.ts and every link was opened before it was added; a link that stops working is
// removed, never guessed at. Keyed on the job-functions label a role carries (RoleDef.fn).

import { MEDIA_BY_FUNCTION } from './media-data'

export type MediaKind = 'podcast' | 'newsletter' | 'publication' | 'community'

export interface MediaItem {
  name: string
  kind: MediaKind
  /** Who makes it: the host, or the publisher. */
  by: string
  /** The show's or publication's own home page. */
  url: string
  /** One plain sentence on what it covers. */
  blurb: string
}

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  podcast: 'Podcast',
  newsletter: 'Newsletter',
  publication: 'Publication',
  community: 'Community',
}

/** The media for a function, podcasts first. Empty when none is curated for it (the section is then left off the page). */
export function mediaForFunction(fn: string, limit = 8): MediaItem[] {
  const order: MediaKind[] = ['podcast', 'newsletter', 'publication', 'community']
  return [...(MEDIA_BY_FUNCTION[fn] ?? [])]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, limit)
}
