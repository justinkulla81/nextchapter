import { fetchText, type SitemapJob } from '@/lib/jobs/gov-feed-core'

// K12JobSpot sitemap reading. No database access.

export const K12_INDEX_URL = 'https://www.k12jobspot.com/sitemap'
export const K12_JOB_URL_PREFIX = 'https://www.k12jobspot.com/en/job-postings/'

export function parseK12Sitemap(xml: string): SitemapJob[] {
  const out: SitemapJob[] = []
  for (const m of xml.matchAll(/<loc>(https:\/\/www\.k12jobspot\.com\/en\/job-postings\/([0-9a-f]{24})-([^<]*))<\/loc>/g)) {
    out.push({ id: m[2], url: m[1], title: m[3].replace(/-+/g, ' ').trim() })
  }
  return out
}

export async function loadK12Jobs(): Promise<SitemapJob[]> {
  const index = await fetchText(K12_INDEX_URL, 30_000)
  const sitemaps = [...(index ?? '').matchAll(/<loc>(https:\/\/www\.k12jobspot\.com\/sitemap\/job\/\d+)<\/loc>/g)].map((m) => m[1])
  const jobs: SitemapJob[] = []
  for (const url of sitemaps) {
    const xml = await fetchText(url, 60_000)
    if (xml) jobs.push(...parseK12Sitemap(xml))
  }
  return jobs
}
