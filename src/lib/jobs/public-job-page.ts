// Public job pages (/jobs/[id]) and their Google for Jobs structured data. Pure — no
// I/O — so the allowlist and the JSON-LD rules are unit-tested
// (src/test/public-job-page.test.ts). The database side is public-job-page-server.ts.
//
// ── Which jobs get a public page (an allowlist: every rule must pass) ─────────
//   status approved, not archived, no closeReason, not past expiresAt
//   verified live (lastVerifiedAt) within the last 7 days
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
export const PUBLIC_JOB_VERIFIED_DAYS = 7
export const PUBLIC_JOB_MIN_DESCRIPTION = 200
/**
 * A job page is offered to search engines only when it holds the real posting text, not a ~280-character snippet from an
 * aggregator feed (about 40% of live jobs on 2026-10-26; Google had crawled them and indexed none). In bytes, so the
 * sitemap SQL (octet_length) and the page agree. Lengths of live jobs split cleanly: under 1,000 is snippet or excerpt,
 * almost none between 1,000 and 1,500, and about 60% are 1,500 or more.
 */
export const PUBLIC_JOB_MIN_INDEX_DESCRIPTION = 1500
export const PUBLIC_JOB_GHOST_AGE_DAYS = 90
/** validThrough when the posting has no expiry of its own: last verified + this. */
export const PUBLIC_JOB_VALID_DAYS = 30
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

export function datePostedOf(job: Pick<PublicJobRow, 'postedAt' | 'createdAt'>): Date {
  return job.postedAt ?? job.createdAt
}

export function validThroughOf(job: Pick<PublicJobRow, 'expiresAt' | 'lastVerifiedAt'>): Date | null {
  if (job.expiresAt) return job.expiresAt
  if (job.lastVerifiedAt) return new Date(job.lastVerifiedAt.getTime() + PUBLIC_JOB_VALID_DAYS * DAY_MS)
  return null
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

  const unit = job.payPeriod ? UNIT_TEXT[job.payPeriod] : undefined
  if (unit && (job.salaryMin || job.salaryMax)) {
    const value: Record<string, unknown> = { '@type': 'QuantitativeValue', unitText: unit }
    if (job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax) {
      value.minValue = job.salaryMin
      value.maxValue = job.salaryMax
    } else {
      value.value = job.salaryMin || job.salaryMax
    }
    data.baseSalary = { '@type': 'MonetaryAmount', currency: job.salaryCurrency || 'USD', value }
  }

  const type = job.employmentType ? EMPLOYMENT_TYPE[job.employmentType] : undefined
  if (type) data.employmentType = type

  return data
}
