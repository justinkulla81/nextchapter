import { NextResponse } from 'next/server'
import { loadAiJobsIndex } from '@/lib/ai-index/load'
import { indexCsv } from '@/lib/ai-index/build'

// The table behind /data/ai-jobs-index: one row per measured occupation, aggregates only. Built from the stored exposure table,
// the stored board figure and the newest AI market snapshot, so a download adds no scan.
export const revalidate = 3600

export async function GET() {
  const index = await loadAiJobsIndex()
  if (!index) return NextResponse.json({ error: 'The index is not available yet.' }, { status: 503, headers: { 'Retry-After': '300' } })
  return new NextResponse(indexCsv(index), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nextchapter-ai-jobs-index-${index.asOf}.csv"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
