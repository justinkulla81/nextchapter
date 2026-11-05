import { EMPLOYEE_JOURNEYS } from '@/lib/journeys/employee-journeys'
import { newsDisplayTitle } from '@/lib/news/slug'
import type { NewsItemView } from '@/lib/news/published'

// The "At work this week" block of the weekly newsletter: the stories that went live in the last seven days, grouped under the journey page
// each belongs to. Pure, so the email and its test read the same thing. A journey with nothing new is left out; with nothing at all, so is the block.

const WEEK = 7 * 86_400_000
/** Stories shown under each journey. The journey page itself has the rest. */
const PER_JOURNEY = 2

export interface JourneyWeekStory { title: string; url: string; source: string }
export interface JourneyWeekGroup { slug: string; label: string; url: string; stories: JourneyWeekStory[] }
export type JourneyWeekBrief = JourneyWeekGroup[]

/** `appUrl` is the site's address; links carry the newsletter's campaign so a click can be traced to the email. */
export function buildJourneyWeekBrief(items: NewsItemView[], appUrl: string, now = Date.now()): JourneyWeekBrief | null {
  const utm = 'utm_source=newsletter&utm_medium=email&utm_campaign=newsletter_weekly'
  const fresh = items
    .filter((i) => {
      const age = now - new Date(i.liveAt).getTime()
      return age >= 0 && age < WEEK
    })
    .sort((a, b) => new Date(b.liveAt).getTime() - new Date(a.liveAt).getTime())
  const groups: JourneyWeekGroup[] = []
  for (const j of EMPLOYEE_JOURNEYS) {
    const stories = fresh.filter((i) => i.tags.includes(j.tag)).slice(0, PER_JOURNEY)
    if (stories.length === 0) continue
    groups.push({
      slug: j.slug,
      label: j.label,
      url: `${appUrl}/journeys/${j.slug}?${utm}`,
      stories: stories.map((s) => ({
        title: newsDisplayTitle(s),
        // An item with our own page opens that first; everything else goes to the source.
        url: s.slug ? `${appUrl}/news/${s.slug}?${utm}` : s.url,
        source: s.source,
      })),
    })
  }
  return groups.length > 0 ? groups : null
}
