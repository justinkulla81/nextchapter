import 'server-only'
import { prisma } from '@/lib/prisma'
import { ATS_COMPANIES, type AtsCompany } from '@/lib/market/ats-companies'
import { isUsLocation } from '@/lib/jobs/us-location'
import { loadAdminFitCandidates } from '@/lib/jobs/job-fit-bucket'
import { inferFunctionFromTitle, inferCalibratedLevelRank } from '@/lib/jobs/infer-job-function'
import { calibratedLevelRank, calibratedLevelDistance } from '@/lib/scoring/level-rank'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { normalizeOrgName } from '@/lib/text/org-name-match'

const FETCH_TIMEOUT_MS = 6000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

interface FeedListing {
  title: string
  companyName: string
  location: string | null
  url: string
  description: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function parseDollarAmount(text: string): number | null {
  const match = text.match(/\$([\d.]+)\s*(K|M)?/i)
  if (!match) return null
  const value = parseFloat(match[1])
  if (Number.isNaN(value)) return null
  const unit = match[2]?.toUpperCase()
  if (unit === 'K') return Math.round(value * 1000)
  if (unit === 'M') return Math.round(value * 1_000_000)
  return Math.round(value)
}

// Ashby's compensationTierSummary is free text like "$81K – $87K • 0.5% –
// 1.75% • Offers Bonus" — no structured min/max field exists, so this pulls
// the two dollar amounts out directly rather than depending on a specific
// separator format.
function parseSalaryRange(summary: string): { min: number | null; max: number | null } {
  const amounts = summary.match(/\$[\d.]+\s*[KM]?/gi) ?? []
  const parsed = amounts.map(parseDollarAmount).filter((n): n is number => n !== null)
  if (parsed.length === 0) return { min: null, max: null }
  if (parsed.length === 1) return { min: parsed[0], max: parsed[0] }
  return { min: Math.min(...parsed), max: Math.max(...parsed) }
}

async function fetchGreenhouseListings(company: AtsCompany): Promise<FeedListing[]> {
  const data = (await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`
  )) as { jobs?: { title: string; location?: { name?: string }; absolute_url: string; content?: string }[] } | null
  if (!data?.jobs) return []
  return data.jobs.map((j) => ({
    title: j.title,
    companyName: company.name,
    location: j.location?.name ?? null,
    url: j.absolute_url,
    description: j.content ? j.content.replace(/<[^>]+>/g, ' ').trim().slice(0, 2000) : null,
    // Greenhouse only exposes salary via a separate per-job
    // ?pay_transparency=true fetch — skipped here to keep this one request
    // per company; these rows land in the review queue flagged as missing
    // a salary band, same as any other incomplete source.
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  }))
}

async function fetchLeverListings(company: AtsCompany): Promise<FeedListing[]> {
  const data = (await fetchJson(`https://api.lever.co/v0/postings/${company.token}?mode=json`)) as
    | {
        text: string
        categories?: { location?: string }
        hostedUrl: string
        descriptionPlain?: string
        salaryRange?: { currency?: string; min?: number; max?: number }
      }[]
    | null
  if (!Array.isArray(data)) return []
  return data.map((j) => ({
    title: j.text,
    companyName: company.name,
    location: j.categories?.location ?? null,
    url: j.hostedUrl,
    description: j.descriptionPlain?.slice(0, 2000) ?? null,
    salaryMin: j.salaryRange?.min ?? null,
    salaryMax: j.salaryRange?.max ?? null,
    salaryCurrency: j.salaryRange?.currency ?? null,
  }))
}

async function fetchAshbyListings(company: AtsCompany): Promise<FeedListing[]> {
  const data = (await fetchJson(
    `https://api.ashbyhq.com/posting-api/job-board/${company.token}?includeCompensation=true`
  )) as
    | {
        jobs?: {
          title: string
          location?: string
          jobUrl: string
          descriptionPlain?: string
          compensation?: { compensationTierSummary?: string }
        }[]
      }
    | null
  if (!data?.jobs) return []
  return data.jobs.map((j) => {
    const summary = j.compensation?.compensationTierSummary
    const { min, max } = summary ? parseSalaryRange(summary) : { min: null, max: null }
    return {
      title: j.title,
      companyName: company.name,
      location: j.location ?? null,
      url: j.jobUrl,
      description: j.descriptionPlain?.slice(0, 2000) ?? null,
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: min !== null ? 'USD' : null,
    }
  })
}

// UNVERIFIED against a live board — JobAdder's public Job Board API needs
// an API key (JOBADDER_API_KEY) unlike the other three providers, which are
// fully public. Field names below (items[], jobTitle, location.area,
// jobAdUrl, summary, salary.ratePer/rateLow/rateHigh/currency) are this
// integration's best-available understanding of JobAdder's Job Board API
// v2 response shape, not confirmed against a real response — do not trust
// this shape until it's been checked against one live company's board (see
// ats-companies.ts's header comment on why every entry needs that before
// being added).
async function fetchJobAdderListings(company: AtsCompany): Promise<FeedListing[]> {
  const apiKey = process.env.JOBADDER_API_KEY
  if (!apiKey) return []
  const data = (await fetchJson(`https://api.jobadder.com/v2/jobboards/${company.token}/ads?apikey=${apiKey}`)) as {
    items?: {
      jobTitle: string
      location?: { area?: string; name?: string }
      jobAdUrl: string
      summary?: string
      salary?: { ratePer?: string; rateLow?: number; rateHigh?: number; currency?: string }
    }[]
  } | null
  if (!data?.items) return []
  return data.items.map((j) => ({
    title: j.jobTitle,
    companyName: company.name,
    location: j.location?.area ?? j.location?.name ?? null,
    url: j.jobAdUrl,
    description: j.summary?.replace(/<[^>]+>/g, ' ').trim().slice(0, 2000) ?? null,
    salaryMin: j.salary?.rateLow ?? null,
    salaryMax: j.salary?.rateHigh ?? null,
    salaryCurrency: j.salary?.currency ?? null,
  }))
}

async function fetchCompanyListings(company: AtsCompany): Promise<FeedListing[]> {
  switch (company.provider) {
    case 'greenhouse':
      return fetchGreenhouseListings(company)
    case 'lever':
      return fetchLeverListings(company)
    case 'ashby':
      return fetchAshbyListings(company)
    case 'jobadder':
      return fetchJobAdderListings(company)
  }
}

export interface AtsFeedResult {
  fetched: number
  created: number
  reconfirmed: number
  skippedNoFit: number
  skippedNonUs: number
}

// Prompt 63, later upgraded — seeds NC Job Board with listings pulled
// directly from each company's own ATS-hosted board (never LinkedIn/
// Indeed). Every row lands as source: 'ats_feed', contactName: null — no
// public ATS feed exposes a named hiring contact (confirmed against the
// real Greenhouse, Lever, and Ashby docs) — but status: 'approved', not
// 'pending': unlike an employer/recruiter self-submission (a real hiring
// need from a real party that still needs a human trust check, since no
// domain verification exists), an ATS row is pulled straight from the
// company's own live careers page, so there's no identity to verify.
//
// This is the one job-board entry point with no real recruiter behind
// it — an algorithm is deciding what goes straight in front of candidates,
// so the bar is real fit, not just a plausible title. Quality over
// quantity: a listing is only admitted if it confidently maps to a
// function (inferFunctionFromTitle — deliberately conservative, see that
// file) that some real candidate has AND that same candidate's calibrated
// seniority (see level-rank.ts — title adjusted for the hiring company's
// size, not just the raw title) is within one band of the title's inferred,
// company-size-adjusted level (calibratedLevelDistance <= 1, e.g. a
// Director-equivalent admits Director/VP/Manager-equivalent listings but
// not IC- or C-Suite-equivalent ones) — one
// genuinely great fit for a single candidate is enough, a crowd of
// mediocre ones isn't. An earlier version of this gate used the admin
// review queue's continuous boosted score (function+level+location+comp+
// title-similarity), but verified against the real live candidate pool
// that let ~97% of US listings through — taking the max across a diverse
// pool means location/comp neutral credits alone clear the bar for nearly
// any professional title, so this uses a hard function+seniority match
// instead of a blended score. Employer/recruiter self-submissions are
// untouched by this — those still land pending either way.
export async function runAtsJobBoardFeed(): Promise<AtsFeedResult> {
  const candidates = await loadAdminFitCandidates()

  // Resolved once, up front, for the whole (small, ~45-company) ATS_COMPANIES
  // list — not per-listing — so the admission-gate loop below stays
  // synchronous. See company-size.ts: a company already in the static tier
  // list or the permanent cache costs nothing here; a first-ever encounter
  // costs one LLM call, cached forever after.
  const companySizeBands = new Map(
    await Promise.all(
      ATS_COMPANIES.map(async (c) => [normalizeOrgName(c.name), (await resolveCompanySizeBand(c.name)).band] as const)
    )
  )

  // Every company's board is fetched concurrently rather than one at a time —
  // awaiting each of the 45 companies in sequence (up to FETCH_TIMEOUT_MS
  // apiece) could exceed this route's maxDuration well before reaching the
  // later companies in ATS_COMPANIES, silently truncating the run to
  // whichever handful happened to be first in the array.
  const perCompanyListings = await Promise.all(ATS_COMPANIES.map((company) => fetchCompanyListings(company)))
  const allListings = perCompanyListings.flat()

  // One existence check for every URL fetched this run, instead of a
  // per-listing findFirst — the same N+1 pattern that made the DB side of
  // this job as slow as the network side once a company's board has
  // hundreds of postings.
  const existingByUrl = new Map(
    (
      await prisma.exclusiveJobPosting.findMany({
        where: { url: { in: allListings.map((l) => l.url) } },
        select: { id: true, url: true, archivedAt: true },
      })
    ).map((row) => [row.url, row])
  )

  const toReconfirmIds: string[] = []
  const toCreate: FeedListing[] = []
  const seenUrls = new Set<string>()
  let skippedNoFit = 0
  let skippedNonUs = 0

  for (const listing of allListings) {
    if (seenUrls.has(listing.url)) continue // defensive de-dupe within one run
    seenUrls.add(listing.url)

    const existing = existingByUrl.get(listing.url)
    if (existing) {
      // Still live in the source feed — a genuine independent
      // re-verification against the origin, not a bare "bump," so it's
      // allowed to push the freshness clock forward the same way an
      // explicit reconfirm would.
      if (!existing.archivedAt) toReconfirmIds.push(existing.id)
      continue
    }

    // US-only — the Job Board is scoped to candidates working in the US, so
    // a listing naming a foreign country/city outright isn't a fit for
    // anyone in the pool regardless of function match.
    if (!isUsLocation(listing.location)) {
      skippedNonUs += 1
      continue
    }

    const inferredFunction = inferFunctionFromTitle(listing.title)
    if (!inferredFunction) {
      skippedNoFit += 1
      continue
    }
    const companySizeBand = companySizeBands.get(normalizeOrgName(listing.companyName)) ?? null
    const inferredLevelScore = inferCalibratedLevelRank(listing.title, companySizeBand)
    const inferredFunctionLower = inferredFunction.toLowerCase()
    const hasFit = candidates.some(
      (c) =>
        (c.primaryFunction?.trim().toLowerCase() === inferredFunctionLower ||
          c.secondaryFunction?.trim().toLowerCase() === inferredFunctionLower) &&
        calibratedLevelDistance(
          c.levelRankScore ?? calibratedLevelRank(c.highestLevelReached, null),
          inferredLevelScore
        ) <= 1
    )
    if (!hasFit) {
      skippedNoFit += 1
      continue
    }

    toCreate.push(listing)
  }

  if (toReconfirmIds.length > 0) {
    await prisma.exclusiveJobPosting.updateMany({
      where: { id: { in: toReconfirmIds } },
      data: { expiresAt: new Date(Date.now() + THIRTY_DAYS_MS), lastConfirmedAt: new Date() },
    })
  }

  if (toCreate.length > 0) {
    await prisma.exclusiveJobPosting.createMany({
      data: toCreate.map((listing) => ({
        title: listing.title,
        companyName: listing.companyName,
        location: listing.location,
        url: listing.url,
        description: listing.description,
        postingType: 'direct',
        source: 'ats_feed',
        status: 'approved',
        contactName: null,
        salaryMin: listing.salaryMin,
        salaryMax: listing.salaryMax,
        salaryCurrency: listing.salaryCurrency,
        addedBy: 'ats_feed',
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
      })),
    })
  }

  return {
    fetched: allListings.length,
    created: toCreate.length,
    reconfirmed: toReconfirmIds.length,
    skippedNoFit,
    skippedNonUs,
  }
}
