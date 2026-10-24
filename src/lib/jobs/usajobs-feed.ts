import 'server-only'

const SEARCH_URL = 'https://data.usajobs.gov/api/search'
const FETCH_TIMEOUT_MS = 15000
const RESULTS_PER_PAGE = 500
const MAX_PAGES = 6
const POSTED_WITHIN_DAYS = 30

export interface UsajobsListing {
  title: string
  companyName: string
  location: string | null
  url: string
  description: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

interface UsajobsItem {
  MatchedObjectDescriptor?: {
    PositionTitle?: string
    PositionURI?: string
    OrganizationName?: string
    DepartmentName?: string
    PositionLocationDisplay?: string
    PositionLocation?: { LocationName?: string; CountryCode?: string }[]
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[]
    JobGrade?: { Code?: string }[]
    UserArea?: { Details?: { JobSummary?: string; LowGrade?: string; HighGrade?: string } }
  }
}

interface UsajobsResponse {
  SearchResult?: {
    SearchResultItems?: UsajobsItem[]
    UserArea?: { NumberOfPages?: number | string }
  }
}

async function fetchPage(page: number, apiKey: string, userAgent: string): Promise<UsajobsResponse | null> {
  const params = new URLSearchParams({
    ResultsPerPage: String(RESULTS_PER_PAGE),
    Page: String(page),
    DatePosted: String(POSTED_WITHIN_DAYS),
    HiringPath: 'public',
    Fields: 'Full',
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(`${SEARCH_URL}?${params}`, {
      signal: controller.signal,
      headers: { Host: 'data.usajobs.gov', 'User-Agent': userAgent, 'Authorization-Key': apiKey },
    })
    if (!response.ok) return null
    return (await response.json()) as UsajobsResponse
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// USAJOBS titles carry no pay grade, but the seniority screen reads it from
// the title ("Program Analyst (GS-14)"), so the highest grade is appended.
function withGrade(title: string, plan: string | undefined, grade: string | undefined): string {
  if (!plan || !grade || /\b(GS|SES|SL|ST)\b/i.test(title)) return title
  return `${title} (${plan}-${grade})`
}

function toListing(item: UsajobsItem): UsajobsListing | null {
  const d = item.MatchedObjectDescriptor
  if (!d?.PositionTitle || !d.PositionURI) return null
  const pay = d.PositionRemuneration?.find((r) => r.RateIntervalCode === 'PA')
  const min = pay?.MinimumRange ? Math.round(Number(pay.MinimumRange)) : NaN
  const max = pay?.MaximumRange ? Math.round(Number(pay.MaximumRange)) : NaN
  const hasPay = Number.isFinite(min) && Number.isFinite(max)
  const summary = d.UserArea?.Details?.JobSummary
  return {
    title: withGrade(d.PositionTitle, d.JobGrade?.[0]?.Code, d.UserArea?.Details?.HighGrade),
    companyName: d.DepartmentName && d.OrganizationName && d.DepartmentName !== d.OrganizationName
      ? `${d.OrganizationName}, ${d.DepartmentName}`
      : (d.OrganizationName ?? d.DepartmentName ?? 'U.S. federal government'),
    location: d.PositionLocationDisplay ?? d.PositionLocation?.[0]?.LocationName ?? null,
    url: d.PositionURI,
    description: summary ? summary.replace(/<[^>]+>/g, ' ').trim().slice(0, 2000) : null,
    salaryMin: hasPay ? min : null,
    salaryMax: hasPay ? max : null,
    salaryCurrency: hasPay ? 'USD' : null,
  }
}

/**
 * Open-to-the-public federal postings from the last 30 days. Returns [] when
 * USAJOBS_API_KEY or USAJOBS_USER_AGENT (the registered email) is unset, so
 * the daily feed keeps running without it.
 */
export async function fetchUsajobsListings(): Promise<UsajobsListing[]> {
  const apiKey = process.env.USAJOBS_API_KEY
  const userAgent = process.env.USAJOBS_USER_AGENT
  if (!apiKey || !userAgent) return []

  const listings: UsajobsListing[] = []
  let totalPages = 1
  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const data = await fetchPage(page, apiKey, userAgent)
    if (!data?.SearchResult) break
    totalPages = Number(data.SearchResult.UserArea?.NumberOfPages ?? 1) || 1
    for (const item of data.SearchResult.SearchResultItems ?? []) {
      const listing = toListing(item)
      if (listing) listings.push(listing)
    }
  }
  return listings
}
