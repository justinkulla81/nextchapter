import 'server-only'
import { prisma } from '@/lib/prisma'
import { ATS_COMPANIES, type AtsCompany } from '@/lib/market/ats-companies'

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

async function fetchCompanyListings(company: AtsCompany): Promise<FeedListing[]> {
  switch (company.provider) {
    case 'greenhouse':
      return fetchGreenhouseListings(company)
    case 'lever':
      return fetchLeverListings(company)
    case 'ashby':
      return fetchAshbyListings(company)
  }
}

export interface AtsFeedResult {
  fetched: number
  created: number
  reconfirmed: number
}

// Prompt 63 — seeds NC Job Board with listings pulled directly from each
// company's own ATS-hosted board (never LinkedIn/Indeed). Every row lands
// as source: 'ats_feed', status: 'pending', contactName: null — no public
// ATS feed exposes a named hiring contact (confirmed against the real
// Greenhouse, Lever, and Ashby docs), so these always need a human to add
// one or reject before going live, same review queue as employer/recruiter
// self-submissions.
export async function runAtsJobBoardFeed(): Promise<AtsFeedResult> {
  let fetched = 0
  let created = 0
  let reconfirmed = 0

  for (const company of ATS_COMPANIES) {
    const listings = await fetchCompanyListings(company)
    fetched += listings.length

    for (const listing of listings) {
      const existing = await prisma.exclusiveJobPosting.findFirst({ where: { url: listing.url } })

      if (existing) {
        // Still live in the source feed — a genuine independent
        // re-verification against the origin, not a bare "bump," so it's
        // allowed to push the freshness clock forward the same way an
        // explicit reconfirm would.
        if (!existing.archivedAt) {
          await prisma.exclusiveJobPosting.update({
            where: { id: existing.id },
            data: { expiresAt: new Date(Date.now() + THIRTY_DAYS_MS), lastConfirmedAt: new Date() },
          })
          reconfirmed += 1
        }
        continue
      }

      await prisma.exclusiveJobPosting.create({
        data: {
          title: listing.title,
          companyName: listing.companyName,
          location: listing.location,
          url: listing.url,
          description: listing.description,
          postingType: 'direct',
          source: 'ats_feed',
          status: 'pending',
          contactName: null,
          salaryMin: listing.salaryMin,
          salaryMax: listing.salaryMax,
          salaryCurrency: listing.salaryCurrency,
          addedBy: 'ats_feed',
          expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
        },
      })
      created += 1
    }
  }

  return { fetched, created, reconfirmed }
}
