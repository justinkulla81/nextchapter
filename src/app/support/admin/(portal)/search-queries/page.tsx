import { requireAdmin } from '@/lib/admin/auth'
import { SearchQueriesView } from '@/components/admin/SearchQueriesView'
import { loadSearchPerformance } from '@/lib/google/search-performance'
import { PERF_WINDOWS, type PerfWindowDays } from '@/lib/seo/search-analysis'

export const metadata = { title: 'Search queries' }
export const maxDuration = 30

function parseDays(raw: string | undefined): PerfWindowDays {
  const n = Number(raw)
  return (PERF_WINDOWS as number[]).includes(n) ? (n as PerfWindowDays) : 28
}

// What people search on Google to find us. Read-only; the result is cached for an hour (src/lib/google/search-performance.ts).
export default async function AdminSearchQueriesPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin()
  const days = parseDays((await searchParams).days)
  const result = await loadSearchPerformance(days)
  return <SearchQueriesView result={result} days={days} />
}
