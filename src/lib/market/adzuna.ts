import 'server-only'
import type { AdzunaResult } from '@/lib/market/types'

export interface AdzunaListing {
  title: string
  companyName: string | null
  location: string | null
  url: string
  description: string | null
}

// Real listings for the Job Discovery Engine — distinct from
// searchAdzunaJobs below, which only returns a count for market-conditions
// commentary. Same credentials, same API, different results_per_page.
export async function searchAdzunaJobListings(
  what: string,
  where: string | null,
  limit = 10,
  options?: { whatOr?: string[]; salaryMin?: number }
): Promise<AdzunaListing[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return []

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what,
    results_per_page: String(limit),
  })
  if (where) params.set('where', where)
  // what_or broadens (any-of) rather than narrows — safe to layer resume
  // keywords/industry on top of the core `what` query without risking zero
  // results the way appending them to `what` (an AND match) would.
  if (options?.whatOr && options.whatOr.length > 0) params.set('what_or', options.whatOr.join(' '))
  if (options?.salaryMin) params.set('salary_min', String(options.salaryMin))

  try {
    const response = await fetch(
      `https://api.adzuna.com/v1/api/jobs/us/search/1?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!response.ok) return []

    const data = (await response.json()) as {
      results?: {
        title?: string
        company?: { display_name?: string }
        location?: { display_name?: string }
        redirect_url?: string
        description?: string
      }[]
    }

    return (data.results ?? [])
      .filter((job) => job.title && job.redirect_url)
      .map((job) => ({
        title: job.title!,
        companyName: job.company?.display_name ?? null,
        location: job.location?.display_name ?? null,
        url: job.redirect_url!,
        description: job.description ?? null,
      }))
  } catch {
    return []
  }
}

export async function searchAdzunaJobs(
  what: string,
  where: string | null,
  distanceMiles = 50,
  // Extra term ANDed onto `what` via Adzuna's what_and param — narrows the
  // count rather than the default fuzzy/any-word match `what` alone does.
  // Used for the "ideal" (title AND industry) count; omitted for the
  // "broader" (title-only) count.
  extraAndTerm?: string | null,
  // Level-synonym breadth (market.ts's level-groups.ts) — "must ALSO
  // contain at least one of these" alongside `what`, same any-of semantics
  // searchAdzunaJobListings' whatOr already documents. Fixes two real,
  // opposite failure modes of a literal title-only search: a long specific
  // title ("VP of Corporate Development") undercounts real postings phrased
  // as "SVP of..."/"Head of..."; a bare ambiguous title ("Partner") used
  // alone overcounts by matching every staff "X Partner" title. Passing the
  // function term as `what` and the level synonyms as `whatOr` requires
  // both, fixing both directions at once.
  whatOr?: string[],
  // Excludes postings whose title contains any of these words — the actual
  // fix for a bare ambiguous level word like "Partner" (see
  // level-groups.ts): title_only alone can't distinguish a genuine equity
  // Partner title from a staff "X Partner" one (Business Partner, HR
  // Partner, Customer Success Partner, etc.), and AND-ing in a broader
  // function term instead doesn't narrow it much either — confirmed live,
  // "Finance" AND "Partner" still returned 1200+ postings. Excluding the
  // known staff qualifiers (infer-job-function.ts's STAFF_PARTNER_QUALIFIERS
  // — the same list neutralizeStaffPartnerPhrase already uses) directly
  // removes them instead.
  whatExclude?: string[]
): Promise<AdzunaResult> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) {
    return { status: 'not_configured', count: null, error: 'Adzuna API credentials are not configured.' }
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    // Adzuna's `title_only` is a direct substitute for `what`, not an
    // add-on flag — it restricts the match to the job title field instead
    // of full-text (title + description). Plain `what` was a real
    // production bug: a single generic word like "Partner" full-text
    // -matched tens of thousands of unrelated postings that merely mention
    // "our partners," "domestic partner benefits," etc. in the body,
    // wildly inflating "roles matching your target title" in the weekly
    // market digest email.
    title_only: what,
    results_per_page: '1',
  })
  if (extraAndTerm) params.set('what_and', extraAndTerm)
  if (whatOr && whatOr.length > 0) params.set('what_or', whatOr.join(' '))
  if (whatExclude && whatExclude.length > 0) params.set('what_exclude', whatExclude.join(' '))
  if (where) {
    params.set('where', where)
    // "How many jobs are near me" should mean a real commutable radius, not
    // Adzuna's much tighter default — this is what marketPosition's local-
    // market-strength read (dossier-competencies.ts) is actually describing.
    params.set('distance', String(distanceMiles))
  }

  try {
    const response = await fetch(
      `https://api.adzuna.com/v1/api/jobs/us/search/1?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!response.ok) {
      return {
        status: 'fetch_failed',
        count: null,
        error: `Adzuna request failed with status ${response.status}.`,
      }
    }
    const data = (await response.json()) as { count?: number }
    return { status: 'success', count: typeof data.count === 'number' ? data.count : null, error: null }
  } catch (error) {
    return {
      status: 'fetch_failed',
      count: null,
      error: error instanceof Error ? error.message : 'Failed to fetch Adzuna job search.',
    }
  }
}
