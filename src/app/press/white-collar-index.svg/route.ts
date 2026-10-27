import { NextResponse } from 'next/server'
import { readWcIndex } from '@/lib/reports-wc-index'
import { indexChartSvg } from '@/lib/press/index-chart-svg'
import { SITE_URL } from '@/lib/reports'

// The White-Collar Long-Search Index as an image anyone may embed with an <img> tag (no iframe, no script). The credit line and
// the source address are drawn into the picture. Built from the published CSV, so it can never disagree with the data file.
export const revalidate = 3600

export async function GET() {
  const svg = indexChartSvg(readWcIndex(), {
    credit: 'NextChapter · CC BY 4.0',
    sourceUrl: `${SITE_URL.replace(/^https?:\/\//, '')}/reports/white-collar-index`,
  })
  if (!svg) return NextResponse.json({ error: 'No index data yet.' }, { status: 503, headers: { 'Retry-After': '300' } })
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
