import { fetchText, type SitemapJob } from '@/lib/jobs/gov-feed-core'

// EdJoin (edjoin.org) sitemap reading: California school districts, county offices of education and community colleges.
// The sitemap has job ids only, no titles. No database access.

export const EDJOIN_INDEX_URL = 'https://www.edjoin.org/sitemap.xml'
export const EDJOIN_URL_PREFIX = 'https://www.edjoin.org/Home/JobPosting/'

export function parseEdjoinSitemap(xml: string): SitemapJob[] {
  const out: SitemapJob[] = []
  for (const m of xml.matchAll(/<loc>(https:\/\/www\.edjoin\.org\/Home\/JobPosting\/(\d+))<\/loc>/g)) out.push({ id: m[2], url: m[1], title: '' })
  return out
}

export async function loadEdjoinJobs(): Promise<SitemapJob[]> {
  const index = await fetchText(EDJOIN_INDEX_URL, 30_000)
  const sitemaps = [...(index ?? '').matchAll(/<loc>(https:\/\/www\.edjoin\.org\/sitemap\/jobs\/\d+)<\/loc>/g)].map((m) => m[1])
  const jobs: SitemapJob[] = []
  for (const url of sitemaps) {
    const xml = await fetchText(url, 90_000)
    if (xml) jobs.push(...parseEdjoinSitemap(xml))
  }
  return jobs
}
