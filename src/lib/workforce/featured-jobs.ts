// Featured jobs, pure parts: the cap, the note, and putting featured jobs first. No database here.

/** An organization features a few jobs, not all of them: a long list stops being a signal. */
export const MAX_FEATURED = 10
export const NOTE_MAX = 160

export const cleanNote = (raw: string) => raw.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) || null

/** Can another job be featured? Returns the reason when not. */
export function featureBlocked(count: number, alreadyFeatured: boolean): string | null {
  if (alreadyFeatured) return 'That job is already featured.'
  if (count >= MAX_FEATURED) return `You can feature ${MAX_FEATURED} jobs at a time. Take one off first.`
  return null
}

/** Featured jobs first (newest featured first), then the rest in the order given. */
export function featuredFirst<T extends { featuredAt?: Date | null }>(rows: T[]): T[] {
  const featured = rows.filter((r) => r.featuredAt).sort((a, b) => +(b.featuredAt as Date) - +(a.featuredAt as Date))
  return [...featured, ...rows.filter((r) => !r.featuredAt)]
}
