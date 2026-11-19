import { Prisma } from '@prisma/client'

// A job-listing scraper spread over home-internet addresses (2026-11-19): each address loads one job page (/jobs/<id>) and
// nothing else, with no referrer, on the same Windows Chrome string. It grew from ~20 addresses a day before Nov 15 to ~440 a
// day, around the clock with no daily rhythm, 45% outside the US, and 4 of 851 did anything else (a click). A user agent or IP
// cannot tell it apart, so the visit as a whole is the signal. A real person who opens one job from a pasted link on Windows
// Chrome and leaves fits too; that is the cost, and anyone who views a second page, clicks, came from a search engine or a
// link with a query string, or is signed in still counts.

export const JOB_PAGE_PATH = /^\/jobs\/c[a-z0-9]{20,30}$/
const WINDOWS_CHROME = /^Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\) .*Chrome\//
/** Seconds either side of the view in which any other event from the address means a person kept going. */
export const JOB_SCRAPE_WINDOW_SECS = 30 * 60

/** The visit's shape alone (one view of one job page), for code that already grouped an address's day. */
export function isJobPageScrapeVisit(v: { views: number; firstPath: string | null; userAgent: string | null; referrer: string | null; hasAccount: boolean }): boolean {
  return v.views === 1 && !v.hasAccount && !v.referrer && !!v.firstPath && JOB_PAGE_PATH.test(v.firstPath) && !!v.userAgent && WINDOWS_CHROME.test(v.userAgent)
}

/**
 * Row filter on "HomepageVisitEvent": true unless the row is a scraper's lone job-page view. The cheap column tests come first;
 * the EXISTS (on the ip, createdAt index) runs only for rows that pass them.
 */
export const notJobPageScrapeSql = Prisma.sql`NOT (
  "eventType" = 'PAGE_VIEW' AND "candidateId" IS NULL AND COALESCE("referrer", '') = ''
  AND "path" ~ '^/jobs/c[a-z0-9]{20,30}$'
  AND "userAgent" ~ '^Mozilla/5\\.0 \\(Windows NT 10\\.0; Win64; x64\\) .*Chrome/'
  AND "ip" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "HomepageVisitEvent" o WHERE o."ip" = "HomepageVisitEvent"."ip" AND o."id" <> "HomepageVisitEvent"."id"
    AND o."createdAt" BETWEEN "HomepageVisitEvent"."createdAt" - make_interval(secs => ${JOB_SCRAPE_WINDOW_SECS})
                          AND "HomepageVisitEvent"."createdAt" + make_interval(secs => ${JOB_SCRAPE_WINDOW_SECS})))`
