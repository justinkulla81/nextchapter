import 'server-only'
import { runSitemapFeed, type SitemapFeedResult } from '@/lib/jobs/gov-sitemap-feed'
import { FL_URL_PREFIX, loadFloridaJobs, parseJobs2Web } from '@/lib/jobs/gov-florida-core'

// State of Florida agency jobs from jobs.myflorida.com. The sitemap has no usable titles (city, title and requisition
// run together), so each new job's page is read and the board's import screen decides; only ids above the highest id
// already on the board are fetched (see numericIds). robots.txt allows the job pages (it blocks apply and email paths).
export async function runFloridaStateFeed(): Promise<SitemapFeedResult> {
  return runSitemapFeed({
    addedBy: 'florida_state_feed',
    sourceName: 'State of Florida',
    urlPrefix: FL_URL_PREFIX,
    titleOk: () => true,
    numericIds: true,
    parse: parseJobs2Web,
    minJobs: 300,
    maxNewPerRun: 1500,
    timeBudgetMs: 40_000,
    loadJobs: loadFloridaJobs,
  })
}
