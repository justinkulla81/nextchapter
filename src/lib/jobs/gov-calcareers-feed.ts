import 'server-only'
import { prisma } from '@/lib/prisma'
import { runSitemapFeed, type SitemapFeedResult } from '@/lib/jobs/gov-sitemap-feed'
import { CALCAREERS_URL_PREFIX, calcareersJobs, parseCalCareers } from '@/lib/jobs/gov-calcareers-core'

// State of California jobs from CalCareers, weekly. About 80 posting ids a day are issued, so each run visits the next
// 2,500 ids above the highest id already on the board (oldest first, so a time cut leaves the newest for the next run) and
// keeps the live postings that pass the board's import screen. A posting leaves the board on its final filing date.
//
// Database reads per run: one range read of this feed's rows by url prefix (id, url and archivedAt only; a few thousand rows).
const WINDOW = 2500

export async function runCalCareersFeed(): Promise<SitemapFeedResult> {
  return runSitemapFeed({
    addedBy: 'calcareers_feed',
    sourceName: 'CalCareers',
    urlPrefix: CALCAREERS_URL_PREFIX,
    titleOk: () => true,
    numericIds: true,
    ascending: true,
    noArchive: true,
    parse: parseCalCareers,
    minJobs: 100,
    maxNewPerRun: WINDOW,
    timeBudgetMs: 60_000,
    workers: 12,
    loadJobs: async () => {
      const rows = await prisma.exclusiveJobPosting.findMany({
        where: { url: { gte: CALCAREERS_URL_PREFIX, lt: CALCAREERS_URL_PREFIX + '￿' }, addedBy: 'calcareers_feed' },
        select: { url: true },
      })
      const top = Math.max(0, ...rows.map((r) => Number(r.url.slice(CALCAREERS_URL_PREFIX.length)) || 0))
      // The first run starts from a recent id; the ids before it are loaded once by hand.
      return calcareersJobs((top || 538_400) + 1, WINDOW)
    },
  })
}
