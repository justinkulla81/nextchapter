import { SITE_URL } from '@/lib/seo/facts'
import { stateName, stateSlug } from '@/lib/seo/states'

export interface RedditNotice {
  id: string
  state: string
  employer: string
  slug: string
  place: string | null
  workers: number | null
  noticeDate: Date
  noticeDateKnown: boolean
  effectiveDate: Date | null
  sourceUrl: string | null
}

const n = (v: number) => v.toLocaleString('en-US')
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * A plain reply for a thread about one employer's layoffs, from the filing alone: who filed, how many workers, the dates, the
 * state's own record, then where an affected worker can go. No guess at why the employer cut jobs and nothing the filing does
 * not say. Written to be edited before it is posted.
 */
export function redditReply(x: RedditNotice): string {
  const where = x.place ? ` for ${x.place}, ${stateName(x.state)}` : ` in ${stateName(x.state)}`
  const filed = x.noticeDateKnown ? `, dated ${day(x.noticeDate)}` : ''
  const effective = x.effectiveDate ? `, with layoffs effective ${day(x.effectiveDate)}` : ''
  return [
    `${x.employer} filed a WARN layoff notice${where}${x.workers ? ` naming ${n(x.workers)} workers` : ''}${filed}${effective}.`,
    x.sourceUrl ? `The state's own record: ${x.sourceUrl}` : '',
    `If you're affected: federal WARN generally requires covered employers to give 60 days' notice, and ${stateName(x.state)}'s unemployment benefits and how to file are here: ${SITE_URL}/unemployment-benefits/${stateSlug(x.state)}`,
    `Every notice we've seen from them: ${SITE_URL}/layoffs/company/${x.slug}?utm_source=reddit&utm_medium=social&utm_campaign=reply`,
  ].filter(Boolean).join('\n\n')
}

/** A state's subreddit is usually its name without spaces; the page tells the reader to check it exists. */
export function stateSubreddit(code: string): string {
  const name = stateName(code)
  return name === 'District of Columbia' ? 'washingtondc' : name.replace(/\s+/g, '')
}

export const redditSearchUrl = (query: string) => `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&sort=new&t=week`

/** A weekly post draft for one state: its own numbers, the state's list linked, nothing about why. */
export function statePostDraft(code: string, notices: number, workers: number): { title: string; body: string } {
  const name = stateName(code)
  return {
    title: `${name} filed ${n(notices)} layoff notices in the last 7 days${workers ? `, naming ${n(workers)} workers` : ''}`,
    body: `These are WARN notices filed with ${name}'s labor department. Each one links to the state's own record: ${SITE_URL}/layoffs/${stateSlug(code)}?utm_source=reddit&utm_medium=social&utm_campaign=state-post\n\nWARN notices are a floor, not every layoff: the law generally covers employers with 100+ workers, and a state can publish a notice days after it is filed.`,
  }
}

export interface Thread { title: string; url: string; sub: string | null }

/** Parses Reddit's public search RSS (Atom). Returns only threads whose title mentions the employer's first word. */
export function parseThreads(xml: string, employer: string): Thread[] {
  const word = employer.split(/\s+/).find((w) => w.length > 2)?.replace(/[^\w]/g, '').toLowerCase()
  const out: Thread[] = []
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1]
    const title = /<title[^>]*>([\s\S]*?)<\/title>/.exec(e)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim()
    const url = /<link[^>]*href="([^"]+)"/.exec(e)?.[1]
    if (!title || !url || !/^https:\/\/(www\.)?reddit\.com\//.test(url)) continue
    if (word && !title.toLowerCase().includes(word)) continue
    out.push({ title, url, sub: /reddit\.com\/r\/([^/]+)\//.exec(url)?.[1] ?? null })
  }
  return out.slice(0, 5)
}
