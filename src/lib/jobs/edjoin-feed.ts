import 'server-only'
import { runSitemapFeed, type SitemapFeedResult } from '@/lib/jobs/gov-sitemap-feed'
import { EDJOIN_URL_PREFIX, loadEdjoinJobs } from '@/lib/jobs/edjoin-core'

// California public school jobs from EdJoin (edjoin.org): administrators, directors, coordinators, counselors and the like
// in school districts, county offices of education and community colleges. robots.txt allows crawling. The sitemap
// lists every open job (about 14,800) with ids only, so each job page is fetched and the board's import screen decides.
// Only ids above the highest id already on the board are fetched, newest first (see numericIds).

export async function runEdjoinFeed(): Promise<SitemapFeedResult> {
  return runSitemapFeed({
    addedBy: 'edjoin_feed',
    sourceName: 'EdJoin',
    urlPrefix: EDJOIN_URL_PREFIX,
    titleOk: () => true,
    numericIds: true,
    minJobs: 3000,
    maxNewPerRun: 1500,
    timeBudgetMs: 100_000,
    loadJobs: loadEdjoinJobs,
  })
}
