import { fetchText, type SitemapJob } from '@/lib/jobs/gov-feed-core'

// CareersInGovernment (careersingovernment.com) sitemap reading: state, county, city and public university jobs posted
// by the agencies. An aggregator's copy, so rows are not marked as taken from the employer's own system. No database access.

export const CIG_SITEMAP_URL = 'https://www.careersingovernment.com/sitemap.xml'
export const CIG_URL_PREFIX = 'https://www.careersingovernment.com/job/'

export function parseCigSitemap(xml: string): SitemapJob[] {
  const out: SitemapJob[] = []
  for (const m of xml.matchAll(/<loc>(https:\/\/www\.careersingovernment\.com\/job\/(\d+)\/([^<\/]*)\/?)<\/loc>/g)) {
    out.push({ id: m[2], url: m[1], title: m[3].replace(/-+/g, ' ').trim() })
  }
  return out
}

export async function loadCigJobs(): Promise<SitemapJob[]> {
  const xml = await fetchText(CIG_SITEMAP_URL, 90_000)
  return xml ? parseCigSitemap(xml) : []
}
