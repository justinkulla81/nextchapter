import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { firmRowsToCsv, loadFirmRows, type FirmFilter } from '@/lib/search-firms/report'

export const maxDuration = 60

const FILTERS: FirmFilter[] = ['live', 'all', 'review', 'no_contacts']

/** The matched firm list as CSV — one line per contact; guessed emails are marked GUESS. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  const f = req.nextUrl.searchParams.get('filter') as FirmFilter | null
  const filter = f && FILTERS.includes(f) ? f : 'live'
  const rows = await loadFirmRows(filter, (req.nextUrl.searchParams.get('q') ?? '').trim(), Infinity)
  captureServerEvent(admin.email ?? 'admin', 'search_firms_exported', { filter, firms: rows.length })
  return new Response(firmRowsToCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="search-firms-${filter}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
