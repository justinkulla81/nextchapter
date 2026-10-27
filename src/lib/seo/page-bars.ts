// Content bars for the programmatic pages that can be thin. A page below its bar stays reachable (noindex, follow) and is
// left out of the sitemap until it has enough of its own to be worth a search result. The bars come from
// scripts/seo/page-quality.py: a page needs roughly 250 words of main content and 5 or more data points, and these are
// the cases where the data behind the page is too small to get there. Pure, so they are unit-tested
// (src/test/page-bars.test.ts).
import { isNetworkCompany, totalWorkers } from '@/lib/network/eligibility'

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000
const TWENTY_FOUR_MONTHS_MS = 2 * TWELVE_MONTHS_MS

/**
 * Employer layoff pages. Every employer with a filing in the last 12 months is indexed, however small (the owner wants every recent
 * layoff page in search: a worker looking up their employer finds it only if the page is). A filing 12 to 24 months old keeps the
 * older bar: enough workers for the employer page, two or more filings, or 50+ named workers. Older than 24 months: never.
 */
export function meetsCompanyLayoffBar(c: { latest: Date; notices: { workers: number | null }[] }, now = Date.now()): boolean {
  const age = now - c.latest.getTime()
  if (age > TWENTY_FOUR_MONTHS_MS) return false
  if (age <= TWELVE_MONTHS_MS) return true
  return isNetworkCompany(c, now) || c.notices.length >= 2 || totalWorkers(c) >= 50
}

/** State pages built from boards and job centers (rapid response, workforce boards): enough centers or boards to fill a page. */
export function meetsStateBoardBar(boards: number, centers: number): boolean {
  return centers >= 5 || boards >= 3
}
