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
  limit = 10
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

export async function searchAdzunaJobs(what: string, where: string | null): Promise<AdzunaResult> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) {
    return { status: 'not_configured', count: null, error: 'Adzuna API credentials are not configured.' }
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what,
    results_per_page: '1',
  })
  if (where) params.set('where', where)

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
