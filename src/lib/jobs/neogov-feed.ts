import 'server-only'
import { fetchText, parseJobPostingLd } from '@/lib/jobs/gov-feed-core'
import { isRelevantTitle, parseSitemap } from '@/lib/jobs/gov-titles'
import { runSitemapFeed, type SitemapFeedResult } from '@/lib/jobs/gov-sitemap-feed'

// Government jobs from NEOGOV (governmentjobs.com), nationwide, kept current weekly.
//
// The site publishes every open job in /sitemap.xml (~41,000 URLs: id and title slug) and each job page carries
// schema.org JobPosting data. See runSitemapFeed for what a run does.
//
// robots.txt allows only named search engines; the owner chose to crawl anyway (2026-11-13). The crawler identifies
// itself, fetches a few pages at a time and stops at a time budget, so a run is bounded and the next run continues.

const SITEMAP_URL = 'https://www.governmentjobs.com/sitemap.xml'
const JOB_URL_PREFIX = 'https://www.governmentjobs.com/jobs/'

export { isRelevantTitle, parseSitemap }

/** Kept for the tests and callers that read a NEOGOV page. */
export const parseJobPage = parseJobPostingLd

export async function runNeogovFeed(): Promise<SitemapFeedResult> {
  return runSitemapFeed({
    addedBy: 'neogov_feed',
    sourceName: 'NEOGOV',
    urlPrefix: JOB_URL_PREFIX,
    titleOk: isRelevantTitle,
    minJobs: 20_000, // a short or broken sitemap must not archive real postings
    maxNewPerRun: 1500,
    timeBudgetMs: 120_000,
    loadJobs: async () => {
      const xml = await fetchText(SITEMAP_URL, 90_000)
      return xml ? parseSitemap(xml) : []
    },
  })
}
