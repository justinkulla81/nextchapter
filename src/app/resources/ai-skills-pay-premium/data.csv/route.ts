import { NextResponse } from 'next/server'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { aiPremiumCsv } from '@/lib/pay/ai-premium'

// The aggregate table behind /resources/ai-skills-pay-premium, as a CSV for anyone to cite or chart. One row per function with
// 30+ paid postings on each side; no posting, employer or person is in it. Built from the newest snapshot (held on the server
// instance for 30 minutes), so it adds no query per download.
export const revalidate = 3600

export async function GET() {
  const live = await loadAiMarket()
  if (!live) return NextResponse.json({ error: 'The first snapshot has not been built yet.' }, { status: 503, headers: { 'Retry-After': '300' } })
  return new NextResponse(aiPremiumCsv(live), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nextchapter-ai-skills-pay-premium-${live.asOf.slice(0, 10)}.csv"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
