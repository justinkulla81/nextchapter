import 'server-only'
import { prisma } from '@/lib/prisma'
import type { AdzunaListing } from '@/lib/market/adzuna'

const SERVICE_NAME = 'jsearch'
const MONTHLY_FREE_CALLS = 200

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

// Atomic increment-then-check via upsert — two concurrent callers can't both
// slip through under the cap the way a separate read-then-write could.
async function tryConsumeCall(): Promise<boolean> {
  const period = currentPeriod()
  const counter = await prisma.apiUsageCounter.upsert({
    where: { service_period: { service: SERVICE_NAME, period } },
    create: { service: SERVICE_NAME, period, count: 1 },
    update: { count: { increment: 1 } },
  })
  return counter.count <= MONTHLY_FREE_CALLS
}

interface JSearchJob {
  job_title: string
  employer_name: string | null
  job_city: string | null
  job_state: string | null
  job_country: string | null
  job_apply_link: string
  job_description: string | null
}

export async function searchJSearchJobs(query: string, where: string | null, limit = 10): Promise<AdzunaListing[]> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) return []

  // Reserve the call before making it — if we're already at/over cap, don't
  // spend a real request just to find that out.
  const allowed = await tryConsumeCall()
  if (!allowed) return []

  const searchQuery = where ? `${query} in ${where}` : query
  const params = new URLSearchParams({
    query: searchQuery,
    num_pages: '1',
    page: '1',
  })

  try {
    const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params.toString()}`, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      },
    })
    if (!response.ok) return []
    const data = (await response.json()) as { data?: JSearchJob[] }
    if (!data.data) return []

    return data.data.slice(0, limit).map((job) => ({
      title: job.job_title,
      companyName: job.employer_name,
      location: [job.job_city, job.job_state].filter(Boolean).join(', ') || job.job_country || null,
      url: job.job_apply_link,
      description: job.job_description,
    }))
  } catch {
    return []
  }
}
