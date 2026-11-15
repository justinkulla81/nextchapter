import 'server-only'
import { runSitemapFeed, type SitemapFeedResult } from '@/lib/jobs/gov-sitemap-feed'
import { isRelevantTitle } from '@/lib/jobs/gov-titles'
import { K12_JOB_URL_PREFIX, loadK12Jobs } from '@/lib/jobs/k12jobspot-core'

// Public school district jobs from K12JobSpot (k12jobspot.com): administrators, directors, coordinators, psychologists,
// counselors and the like. robots.txt allows crawling (it disallows only /auth/, /api/ and /health). Same method as the
// NEOGOV feed: the sitemap lists every open job (about 6,800), each job page carries JobPosting data, and the board's
// own import screen decides what is kept. Postings marked internal-only are skipped.

export async function runK12JobSpotFeed(): Promise<SitemapFeedResult> {
  return runSitemapFeed({
    addedBy: 'k12jobspot_feed',
    sourceName: 'K12JobSpot',
    urlPrefix: K12_JOB_URL_PREFIX,
    titleOk: isRelevantTitle,
    minJobs: 3000,
    maxNewPerRun: 1500,
    timeBudgetMs: 40_000,
    loadJobs: loadK12Jobs,
  })
}
