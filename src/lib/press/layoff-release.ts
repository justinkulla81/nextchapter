import 'server-only'
import { getPublicNotices, type PublicNotice } from '@/lib/warn/layoff-pages'
import { buildRelease, parseReleaseSlug, releaseMonths, type Release, type ReleaseSlug } from './layoff-release-core'

/** Every release month, newest first. A failed read returns an empty list. */
export async function listReleases(): Promise<ReleaseSlug[]> {
  try {
    return releaseMonths(await getPublicNotices())
  } catch {
    return []
  }
}

/** One month's release, or null when the slug is not a month, has no notices, or the read failed. */
export async function getRelease(slug: string): Promise<Release | null> {
  const parsed = parseReleaseSlug(slug)
  if (!parsed) return null
  try {
    return buildRelease(await getPublicNotices(), parsed.year, parsed.month)
  } catch {
    return null
  }
}

export async function noticesInMonth(slug: string): Promise<PublicNotice[]> {
  const parsed = parseReleaseSlug(slug)
  if (!parsed) return []
  const all = await getPublicNotices().catch(() => [] as PublicNotice[])
  return all.filter((x) => x.noticeDate.getUTCFullYear() === parsed.year && x.noticeDate.getUTCMonth() === parsed.month)
}
