import 'server-only'
import { ATS_COMPANIES, type AtsCompany } from '@/lib/market/ats-companies'
import type { AdzunaListing } from '@/lib/market/adzuna'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'

const FETCH_TIMEOUT_MS = 4000
// None of Greenhouse/Lever/Ashby's public per-company endpoints support a
// server-side search query — each only returns "all open jobs at this one
// company." Polling every company in the curated list on every page load
// would mean 50+ parallel external requests per candidate visit, so each
// call instead samples a bounded, rotating subset and filters client-side.
const COMPANIES_PER_CALL = 14

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

async function fetchGreenhouseJobs(company: AtsCompany): Promise<AdzunaListing[]> {
  const data = (await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=false`
  )) as { jobs?: { title: string; location?: { name?: string }; absolute_url: string }[] } | null
  if (!data?.jobs) return []
  return data.jobs.map((j) => ({
    title: j.title,
    companyName: company.name,
    location: j.location?.name ?? null,
    url: j.absolute_url,
    description: null,
  }))
}

async function fetchLeverJobs(company: AtsCompany): Promise<AdzunaListing[]> {
  const data = (await fetchJson(`https://api.lever.co/v0/postings/${company.token}?mode=json`)) as
    | { text: string; categories?: { location?: string }; hostedUrl: string }[]
    | null
  if (!Array.isArray(data)) return []
  return data.map((j) => ({
    title: j.text,
    companyName: company.name,
    location: j.categories?.location ?? null,
    url: j.hostedUrl,
    description: null,
  }))
}

async function fetchAshbyJobs(company: AtsCompany): Promise<AdzunaListing[]> {
  const data = (await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${company.token}`)) as {
    jobs?: { title: string; location?: string; jobUrl: string }[]
  } | null
  if (!data?.jobs) return []
  return data.jobs.map((j) => ({
    title: j.title,
    companyName: company.name,
    location: j.location ?? null,
    url: j.jobUrl,
    description: null,
  }))
}

async function fetchCompanyJobs(company: AtsCompany): Promise<AdzunaListing[]> {
  switch (company.provider) {
    case 'greenhouse':
      return fetchGreenhouseJobs(company)
    case 'lever':
      return fetchLeverJobs(company)
    case 'ashby':
      return fetchAshbyJobs(company)
  }
}

// Deterministic-per-day rotation (not per-request random) so a candidate's
// queue samples across the whole company list over successive visits
// instead of hammering the same handful every time or being pure noise.
function pickCompaniesForToday(seed: string, count: number): AtsCompany[] {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const start = (hash + dayIndex) % ATS_COMPANIES.length
  const picked: AtsCompany[] = []
  for (let i = 0; i < count && i < ATS_COMPANIES.length; i++) {
    picked.push(ATS_COMPANIES[(start + i) % ATS_COMPANIES.length])
  }
  return picked
}

function matchesQuery(title: string, queryTokens: string[]): boolean {
  const lowerTitle = title.toLowerCase()
  return queryTokens.some((token) => lowerTitle.includes(token))
}

export async function searchAtsJobs(
  query: string,
  limit: number,
  rotationSeed: string,
  candidateFunctions: { primaryFunction: string | null; secondaryFunction: string | null }
): Promise<AdzunaListing[]> {
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
  if (queryTokens.length === 0) return []

  // Greenhouse/Lever/Ashby don't support server-side search (see the note on
  // COMPANIES_PER_CALL above), so `matchesQuery` is a bare single-token
  // substring OR match over each company's full open-jobs list — on its own
  // that's enough for a target role like "Business Operations" to pull in an
  // unrelated "Business Partner Analyst" title just because it shares the
  // word "business". Require the title's own inferred function to actually
  // agree with the candidate's, the same admission bar the ATS job-board
  // feed already applies (ats-job-board-feed.ts) — falls back to the bare
  // token match only when the candidate has no function on file to check
  // against.
  const targetFunctions = [candidateFunctions.primaryFunction, candidateFunctions.secondaryFunction]
    .filter((f): f is string => !!f)
    .map((f) => f.toLowerCase())

  const companies = pickCompaniesForToday(rotationSeed, COMPANIES_PER_CALL)
  const results = await Promise.all(companies.map(fetchCompanyJobs))
  const matched = results
    .flat()
    .filter((job) => matchesQuery(job.title, queryTokens))
    .filter((job) => {
      if (targetFunctions.length === 0) return true
      const inferredFunction = inferFunctionFromTitle(job.title)
      return inferredFunction !== null && targetFunctions.includes(inferredFunction.toLowerCase())
    })
  return matched.slice(0, limit)
}
