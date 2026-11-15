import 'server-only'
import { runSitemapFeed, type SitemapFeedResult } from '@/lib/jobs/gov-sitemap-feed'
import { isRelevantTitle } from '@/lib/jobs/gov-titles'
import { CIG_URL_PREFIX, loadCigJobs } from '@/lib/jobs/careersingov-core'

// State, county, city and public university jobs from CareersInGovernment (careersingovernment.com), which agencies
// post to directly. robots.txt allows /job/. It is an aggregator, so rows are not marked as the employer's own listing,
// and a job whose employer and title match one already on the board from NEOGOV, USAJOBS, K12JobSpot or EdJoin is skipped.

export async function runCareersInGovFeed(): Promise<SitemapFeedResult> {
  return runSitemapFeed({
    addedBy: 'careersingov_feed',
    sourceName: 'CareersInGovernment',
    direct: false,
    urlPrefix: CIG_URL_PREFIX,
    titleOk: isRelevantTitle,
    numericIds: true,
    dedupeAgainstUrlPrefixes: [
      'https://www.governmentjobs.com/jobs/',
      'https://www.usajobs.gov/job/',
      'https://www.k12jobspot.com/en/job-postings/',
      'https://www.edjoin.org/Home/JobPosting/',
    ],
    minJobs: 2000,
    maxNewPerRun: 1500,
    timeBudgetMs: 40_000,
    loadJobs: loadCigJobs,
  })
}
