import { toCsv, toRow } from '@/lib/data/layoff-export'
import { noticesInMonth } from '@/lib/press/layoff-release'
import { parseReleaseSlug } from '@/lib/press/layoff-release-core'

export const revalidate = 21600 // 6 hours

// One month of the layoff record as a spreadsheet: the same notices the release counts, one row per filing.
export async function GET(_request: Request, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params
  if (!parseReleaseSlug(month)) return new Response('Use a month like 2026-10.', { status: 404 })
  const rows = (await noticesInMonth(month)).map(toRow)
  if (!rows.length) return new Response('No layoff notices for that month.', { status: 404 })
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `inline; filename="nextchapter-layoffs-${month}.csv"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
