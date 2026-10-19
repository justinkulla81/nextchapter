// Anonymous homepage job search. Unpersonalized by design: newest first, matched on
// the words typed. Rate limited per IP so the board can't be scraped through it, and
// it never returns more than one page.

import { NextResponse } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { cleanPublicQuery, searchPublicBoard } from '@/lib/jobs/public-board'

export const maxDuration = 30

export async function GET(req: Request) {
  if (!(await allowByIp('public-jobs', 60, HOUR_MS))) {
    return NextResponse.json({ error: 'Too many searches. Create a free account to keep searching.' }, { status: 429 })
  }
  const sp = new URL(req.url).searchParams
  const query = cleanPublicQuery({ q: sp.get('q'), loc: sp.get('loc'), remote: sp.get('remote') })
  try {
    const result = await searchPublicBoard(query)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (error) {
    console.error('public job search failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Search is unavailable right now.' }, { status: 500 })
  }
}
