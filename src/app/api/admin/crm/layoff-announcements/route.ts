import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { announceLayoff, type AnnouncedLayoff } from '@/lib/warn/layoff-announce'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 120

const MAX_LAYOFFS = 10

function parse(raw: unknown): AnnouncedLayoff | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)
  if (typeof o.company !== 'string' || !o.company.trim()) return null
  if (typeof o.sourceUrl !== 'string' || !/^https?:\/\//.test(o.sourceUrl)) return null
  if (typeof o.noticeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.noticeDate)) return null
  if (o.kind !== 'sec' && o.kind !== 'news') return null
  return {
    company: o.company.trim(), sourceUrl: o.sourceUrl, noticeDate: o.noticeDate, kind: o.kind, confirmed: o.confirmed === true,
    state: typeof o.state === 'string' && /^[A-Za-z]{2}$/.test(o.state) ? o.state.toUpperCase() : null,
    employees: num(o.employees), percent: typeof o.percent === 'number' && o.percent > 0 && o.percent <= 100 ? o.percent : null,
  }
}

// Write path for the layoff-watch scheduled task: it finds layoffs in news and EDGAR, and this files each one
// and sends the app's full alert, so the task never mails a shorter version of its own. Same Bearer key as the
// other local scheduled jobs. Re-posting a layoff is harmless: a source link already on file, or the same
// employer within 45 days, comes back as not filed.
export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { layoffs?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON: { layoffs: [{ company, noticeDate, sourceUrl, kind, confirmed, state?, employees?, percent? }] }' }, { status: 400 })
  }
  const list = Array.isArray(body.layoffs) ? body.layoffs : []
  if (list.length > MAX_LAYOFFS) return NextResponse.json({ error: `Send at most ${MAX_LAYOFFS} layoffs per request` }, { status: 400 })

  const results = []
  for (const raw of list) {
    const layoff = parse(raw)
    if (!layoff) { results.push({ error: 'invalid layoff' }); continue }
    const r = await announceLayoff(layoff).catch((e) => ({ filed: false, error: e instanceof Error ? e.message : String(e) }))
    results.push({ company: layoff.company, ...r })
    captureServerEvent('layoff-watch', 'layoff_announcement_filed', { company: layoff.company, kind: layoff.kind, filed: r.filed })
  }
  return NextResponse.json({ results })
}
