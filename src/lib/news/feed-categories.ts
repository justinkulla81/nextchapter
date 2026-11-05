import { journeyForTag } from '@/lib/journeys/employee-journeys'
import { newsTagLabel, type NewsTagKey } from './tags'

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/**
 * The RSS `<category>` lines for a News item: one per topic. A journey's topic carries the address of its journey page in the `domain`
 * attribute (RSS 2.0's "taxonomy" slot), so a reader or aggregator can group an item under the journey and link to it.
 */
export function rssCategories(tags: readonly NewsTagKey[], site: string): string[] {
  return tags.map((t) => {
    const j = journeyForTag(t)
    return j
      ? `<category domain="${esc(`${site}/journeys/${j.slug}`)}">${esc(newsTagLabel(t))}</category>`
      : `<category>${esc(newsTagLabel(t))}</category>`
  })
}
