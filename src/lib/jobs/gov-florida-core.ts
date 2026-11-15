import { decodeEntities, fetchText, htmlToText, type FeedPosting, type SitemapJob } from '@/lib/jobs/gov-feed-core'
import { yearlyPayFrom } from '@/lib/jobs/gov-workday-core'

// State of Florida jobs (jobs.myflorida.com, People First on SAP SuccessFactors career sites): the sitemap lists every
// open job, and each job page carries schema.org microdata instead of JSON-LD. No database access.

export const FL_SITEMAP_URL = 'https://jobs.myflorida.com/sitemap.xml'
export const FL_URL_PREFIX = 'https://jobs.myflorida.com/job/'

export function parseFloridaSitemap(xml: string): SitemapJob[] {
  const out: SitemapJob[] = []
  for (const m of xml.matchAll(/<loc>(https:\/\/jobs\.myflorida\.com\/job\/([^<]*?)\/(\d+)\/?)<\/loc>/g)) {
    out.push({ id: m[3], url: m[1], title: decodeURIComponent(m[2]).replace(/-/g, ' ') })
  }
  return out
}

export async function loadFloridaJobs(): Promise<SitemapJob[]> {
  const xml = await fetchText(FL_SITEMAP_URL, 90_000)
  return xml ? parseFloridaSitemap(xml) : []
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** A SuccessFactors job page (microdata) as a posting; null when the page has no title. */
export function parseJobs2Web(page: string): FeedPosting | null {
  const t = /itemprop="title"[^>]*>([\s\S]*?)<\/span>/.exec(page)
  if (!t) return null
  const title = decodeEntities(t[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').replace(/\s*-\s*\d{6,}(\s+\d+)?\s*$/, '').trim()
  if (!title) return null
  const start = page.indexOf('class="jobdescription"')
  const end = start >= 0 ? page.indexOf('jobGeoLocation', start) : -1
  const description = start >= 0 ? htmlToText(page.slice(start, end > start ? end : start + 60_000)) : ''
  const agency = /Agency:\s*([^\n]+)/.exec(description)?.[1]?.trim()
  const city = /itemprop="addressLocality" content="([^"]*)"/.exec(page)?.[1]?.trim()
  const region = /itemprop="addressRegion" content="([^"]*)"/.exec(page)?.[1]?.trim()
  const location = [city ? titleCase(city) : '', region ?? ''].filter(Boolean).join(', ') || null
  const postedRaw = /itemprop="datePosted" content="([^"]*)"/.exec(page)?.[1]
  const posted = postedRaw ? new Date(postedRaw) : null
  const pay = yearlyPayFrom(description)
  return {
    title,
    employer: agency ? `State of Florida, ${agency}` : 'State of Florida',
    location,
    state: region && /^[A-Z]{2}$/.test(region) ? region : null,
    description,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: null,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
  }
}
