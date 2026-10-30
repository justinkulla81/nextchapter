// Public job pages (/jobs/[id]) and their Google for Jobs structured data. Pure — no
// I/O — so the allowlist and the JSON-LD rules are unit-tested
// (src/test/public-job-page.test.ts). The database side is public-job-page-server.ts.
//
// ── Which jobs get a public page (an allowlist: every rule must pass) ─────────
//   status approved, not archived, no closeReason, not past expiresAt
//   verified live (lastVerifiedAt) within the last 14 days (PUBLIC_JOB_VERIFIED_DAYS)
//   a description of at least 200 characters
//   disclosure OPEN (company named) and distribution OPEN (shown to every member —
//     TARGETED goes only to fit-matched members, EXCLUDED to nobody)
//   no institution or organization scope (Higher Ed / Growth internal roles)
//   source on PUBLIC_JOB_SOURCES — never 'candidate_check' (a member's private
//     job-fit check) or 'candidate_referral'
//   not an internship (type or title) — internships only live in Higher Ed portals
//   in the US: locationCountry 'US', or no country but a US state
//   not a ghost job by the member board's rule (ghost-risk.ts): closed and came back
//     fewer than 2 times, and first seen within 90 days unless it is a direct
//     employer listing that never closed before; never admin-confirmed as a ghost
// Anything else is a 404 (notFound()), so Google drops a page once its job closes.
//
// The sitemap query (public-job-page-server.ts PUBLIC_JOB_STATIC_SQL + the time
// rules) and the partial index behind it
// (prisma/manual/2026-10-22-public-job-pages.sql) express the same rules in SQL.
// Change all three together.

export const PUBLIC_JOB_SOURCES = ['ats_feed', 'admin', 'employer', 'recruiter'] as const
/**
 * How recently the crawl must have confirmed a job open for it to keep a page. The crawl re-checks a job every 4 to 16 days
 * (2026-10-30: 349k of 652k live jobs verified within 7 days, 617k within 14), so 7 days hid about 300k open jobs behind a 404.
 */
export const PUBLIC_JOB_VERIFIED_DAYS = 14
export const PUBLIC_JOB_MIN_DESCRIPTION = 200
/**
 * A job page is offered to search engines only when it holds the real posting text, not a ~280-character snippet from an
 * aggregator feed (about 40% of live jobs on 2026-10-26; Google had crawled them and indexed none). In bytes, so the
 * sitemap SQL (octet_length) and the page agree. Lengths of live jobs split cleanly: under 1,000 is snippet or excerpt,
 * almost none between 1,000 and 1,500, and about 60% are 1,500 or more.
 */
export const PUBLIC_JOB_MIN_INDEX_DESCRIPTION = 1500
export const PUBLIC_JOB_GHOST_AGE_DAYS = 90
/** validThrough when the posting has no expiry of its own: last verified + this. The same as the days the page lives, so the date never promises a page that is gone. */
export const PUBLIC_JOB_VALID_DAYS = PUBLIC_JOB_VERIFIED_DAYS
/** Job sitemap files (src/app/jobs/sitemap.ts), by (hashtext(id) & 15). */
export const PUBLIC_JOB_SITEMAP_SHARDS = 16

const INTERNSHIP_TYPES = new Set(['internship', 'co_op', 'coop'])
// Same words as the SQL rule: \m(intern|interns|internships?|student trainee)\M
const INTERN_TITLE = /\b(intern|interns|internships?|student trainee)\b/i
const DAY_MS = 86_400_000

export interface PublicJobRow {
  id: string
  title: string
  companyName: string
  location: string | null
  description: string | null
  url: string
  status: string
  archivedAt: Date | null
  closeReason: string | null
  expiresAt: Date | null
  lastVerifiedAt: Date | null
  createdAt: Date
  postedAt: Date | null
  disclosure: string
  distribution: string
  institutionScopeId: string | null
  orgScopeId: string | null
  source: string
  employmentType: string | null
  locationCountry: string | null
  locationState: string | null
  locationCity: string | null
  workArrangement: string | null
  reopenCount: number | null
  repostCount: number | null
  directListing: boolean
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  payPeriod: string | null
  /** Posting signals and the no-experience phrase (entry-filters.ts); optional so older callers and fixtures still fit. */
  postingSignals?: string[]
  noExperiencePhrase?: string | null
  trainingPhrase?: string | null
  externalJobId: string | null
  requisitionId: string | null
  company: { website: string | null } | null
}

/** True when the page has the posting's own text, enough to stand on its own in search (see PUBLIC_JOB_MIN_INDEX_DESCRIPTION). */
export function isIndexableJob(job: Pick<PublicJobRow, 'description'>): boolean {
  return new TextEncoder().encode(job.description ?? '').length >= PUBLIC_JOB_MIN_INDEX_DESCRIPTION
}

/**
 * True when the crawl last confirmed the job open more than PUBLIC_JOB_VERIFIED_DAYS ago. A job with no verification date at all
 * (employer-posted, never crawled) is not stale. Lists use this to stop showing a job whose own page would 404 (isPublicJob).
 */
export function isStaleVerified(lastVerifiedAt: Date | null, nowMs: number): boolean {
  return !!lastVerifiedAt && nowMs - lastVerifiedAt.getTime() > PUBLIC_JOB_VERIFIED_DAYS * DAY_MS
}

/** The allowlist above. `confirmedGhost`: an admin confirmed member ghost flags on it. */
export function isPublicJob(job: PublicJobRow, nowMs: number, confirmedGhost = false): boolean {
  if (job.status !== 'approved' || job.archivedAt || job.closeReason) return false
  if (job.expiresAt && job.expiresAt.getTime() <= nowMs) return false
  if (!job.lastVerifiedAt || nowMs - job.lastVerifiedAt.getTime() > PUBLIC_JOB_VERIFIED_DAYS * DAY_MS) return false
  if ((job.description?.length ?? 0) < PUBLIC_JOB_MIN_DESCRIPTION) return false
  if (job.disclosure !== 'OPEN' || job.distribution !== 'OPEN') return false
  if (job.institutionScopeId || job.orgScopeId) return false
  if (!(PUBLIC_JOB_SOURCES as readonly string[]).includes(job.source)) return false
  if (job.employmentType && INTERNSHIP_TYPES.has(job.employmentType)) return false
  if (INTERN_TITLE.test(job.title)) return false
  if (!(job.locationCountry === 'US' || (job.locationCountry === null && job.locationState))) return false
  const reopen = job.reopenCount ?? 0
  const repost = job.repostCount ?? 0
  if (reopen >= 2 || repost >= 2) return false
  if (nowMs - job.createdAt.getTime() > PUBLIC_JOB_GHOST_AGE_DAYS * DAY_MS && !(job.directListing && reopen === 0 && repost === 0)) return false
  if (confirmedGhost) return false
  return true
}

export function isRemoteJob(job: Pick<PublicJobRow, 'workArrangement' | 'location'>): boolean {
  return job.workArrangement === 'remote' || /\bremote\b/i.test(job.location ?? '')
}

/** "San Francisco, CA", "Remote (US)", or the source's own text. */
export function placeLabel(job: Pick<PublicJobRow, 'workArrangement' | 'location' | 'locationCity' | 'locationState'>): string | null {
  const place = job.locationCity && job.locationState ? `${job.locationCity}, ${job.locationState}` : job.location || job.locationState
  if (isRemoteJob(job)) return place && !/\bremote\b/i.test(place) && place !== 'United States' ? `Remote · ${place}` : 'Remote (US)'
  return place ?? null
}

const PERIOD_LABEL: Record<string, string> = { year: 'a year', month: 'a month', week: 'a week', day: 'a day', hour: 'an hour' }

/** "$180k–$220k a year", "$45–$60 an hour". Null when the pay or its unit is unknown. */
export function payLabel(min: number | null, max: number | null, period: string | null): string | null {
  if (!min && !max) return null
  const yearly = period === 'year' || (!period && (min ?? max ?? 0) >= 20000)
  const fmt = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : `$${n.toLocaleString('en-US')}`)
  const range = min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : min ? (max ? fmt(min) : `From ${fmt(min)}`) : `Up to ${fmt(max!)}`
  const unit = period ? PERIOD_LABEL[period] : yearly ? 'a year' : null
  return unit ? `${range} ${unit}` : range
}

/** The description split into paragraphs for display (it is stored as plain text). */
export function descriptionParagraphs(text: string | null): string[] {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function descriptionHtml(text: string | null): string {
  return descriptionParagraphs(text)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// Google's employmentType enum. Only types that map exactly; interim, fractional,
// advisory and board are left out rather than guessed.
const EMPLOYMENT_TYPE: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  temporary: 'TEMPORARY',
  per_diem: 'PER_DIEM',
}

const UNIT_TEXT: Record<string, string> = { year: 'YEAR', month: 'MONTH', week: 'WEEK', day: 'DAY', hour: 'HOUR' }

/** When the employer posted it; never a future date (a source clock a day ahead would fail Google's check). */
export function datePostedOf(job: Pick<PublicJobRow, 'postedAt' | 'createdAt'>): Date {
  const d = job.postedAt ?? job.createdAt
  return d.getTime() > Date.now() ? job.createdAt : d
}

/** The earlier of the posting's own expiry and the day our page stops (last verified + PUBLIC_JOB_VALID_DAYS). */
export function validThroughOf(job: Pick<PublicJobRow, 'expiresAt' | 'lastVerifiedAt'>): Date | null {
  const pageEnds = job.lastVerifiedAt ? new Date(job.lastVerifiedAt.getTime() + PUBLIC_JOB_VALID_DAYS * DAY_MS) : null
  if (job.expiresAt && pageEnds) return job.expiresAt < pageEnds ? job.expiresAt : pageEnds
  return job.expiresAt ?? pageEnds
}

/**
 * Pay Google may show: only what the source stated, with a unit, in a believable range. A range stored backwards is put right;
 * a figure that cannot be a real wage for its unit (a yearly "$12", an hourly "$900") is left out rather than shown wrong.
 */
export function plausiblePay(job: Pick<PublicJobRow, 'salaryMin' | 'salaryMax' | 'payPeriod'>): { min: number | null; max: number | null; unit: string } | null {
  const unit = job.payPeriod ? UNIT_TEXT[job.payPeriod] : undefined
  if (!unit) return null
  let min = job.salaryMin || null
  let max = job.salaryMax || null
  if (min && max && min > max) [min, max] = [max, min]
  const top = max ?? min
  if (!top) return null
  const BOUNDS: Record<string, [number, number]> = { YEAR: [15_000, 5_000_000], MONTH: [1_000, 400_000], WEEK: [250, 100_000], DAY: [50, 20_000], HOUR: [7, 500] }
  const [lo, hi] = BOUNDS[unit]
  if (top < lo || top > hi || (min && min < lo)) return null
  return { min, max, unit }
}

/** The fields Google's Jobs experience requires, absent from a JobPosting object. Empty means it qualifies. */
export function missingRequiredJobFields(ld: Record<string, unknown>): string[] {
  const missing: string[] = []
  const has = (k: string) => ld[k] !== undefined && ld[k] !== null && ld[k] !== ''
  for (const k of ['title', 'description', 'datePosted', 'validThrough', 'hiringOrganization', 'identifier', 'directApply']) if (!has(k)) missing.push(k)
  const org = ld.hiringOrganization as { name?: string } | undefined
  if (has('hiringOrganization') && !org?.name) missing.push('hiringOrganization.name')
  if (!has('jobLocation') && !has('applicantLocationRequirements')) missing.push('jobLocation|applicantLocationRequirements')
  if (has('jobLocationType') && !has('applicantLocationRequirements')) missing.push('applicantLocationRequirements')
  const posted = Date.parse(String(ld.datePosted))
  const through = Date.parse(String(ld.validThrough))
  if (has('datePosted') && Number.isNaN(posted)) missing.push('datePosted(valid)')
  if (has('validThrough') && (Number.isNaN(through) || (!Number.isNaN(posted) && through <= posted))) missing.push('validThrough(after datePosted)')
  return missing
}

/**
 * schema.org JobPosting for Google for Jobs
 * (https://developers.google.com/search/docs/appearance/structured-data/job-posting).
 * Only values we hold: a field we don't know is left out, never guessed.
 */
export function jobPostingJsonLd(job: PublicJobRow): Record<string, unknown> {
  const remote = isRemoteJob(job)
  const validThrough = validThroughOf(job)
  const website = job.company?.website && /^https?:\/\//i.test(job.company.website) ? job.company.website : null
  const identifierValue = job.requisitionId || job.externalJobId

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: descriptionHtml(job.description),
    datePosted: datePostedOf(job).toISOString(),
    ...(validThrough ? { validThrough: validThrough.toISOString() } : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companyName,
      ...(website ? { sameAs: website } : {}),
    },
    identifier: {
      '@type': 'PropertyValue',
      name: identifierValue ? job.companyName : 'NextChapter',
      value: identifierValue || job.id,
    },
    directApply: false,
  }

  if (remote) {
    data.jobLocationType = 'TELECOMMUTE'
    data.applicantLocationRequirements =
      job.locationCountry === null && job.locationState
        ? { '@type': 'State', name: job.locationState }
        : { '@type': 'Country', name: 'USA' }
  } else {
    data.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.locationCity ? { addressLocality: job.locationCity } : {}),
        ...(job.locationState ? { addressRegion: job.locationState } : {}),
        addressCountry: 'US',
      },
    }
  }

  const pay = plausiblePay(job)
  if (pay) {
    const value: Record<string, unknown> = { '@type': 'QuantitativeValue', unitText: pay.unit }
    if (pay.min && pay.max && pay.min !== pay.max) {
      value.minValue = pay.min
      value.maxValue = pay.max
    } else {
      value.value = pay.min || pay.max
    }
    data.baseSalary = { '@type': 'MonetaryAmount', currency: job.salaryCurrency || 'USD', value }
  }

  const type = job.employmentType ? EMPLOYMENT_TYPE[job.employmentType] : undefined
  if (type) data.employmentType = type

  return data
}
