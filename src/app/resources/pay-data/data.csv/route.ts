import { NextResponse } from 'next/server'
import { groupsCsv } from '@/lib/pay-data/csv'
import { loadPayData } from '@/lib/pay-data/load'

// Pay by industry, function, level, employer size and hiring volume as tidy CSV (aggregates only), the table behind /resources/pay-data.
export const revalidate = 21600

export async function GET() {
  const d = await loadPayData()
  if (!d) return NextResponse.json({ error: 'The first figures have not been built yet.' }, { status: 503, headers: { 'Retry-After': '300' } })
  return new NextResponse(groupsCsv(d), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nextchapter-pay-data-${d.computedAt.slice(0, 10)}.csv"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
