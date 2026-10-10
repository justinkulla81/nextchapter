import { NextRequest, NextResponse } from 'next/server'
import { scoreAllPartners } from '@/lib/geo/score-partners'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 300

/**
 * Weekly, after the workforce-board sync and college re-rank: recomputes the
 * 0-100 fit score for every WIOA board, job center, EDA district, state agency,
 * local EDO and nonprofit lead. Contacts and warmth in the CRM move during the
 * week, and so do layoffs, so a stored score goes stale. ?dry=1 computes only.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = request.nextUrl.searchParams.get('dry') === '1'
  const started = Date.now()
  try {
    const summary = await scoreAllPartners(!dry)
    if (!dry) captureServerEvent('system', 'partner_scores_refreshed', { ms: Date.now() - started, ...Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.n])) })
    return NextResponse.json({ ok: true, dry, ms: Date.now() - started, summary })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
