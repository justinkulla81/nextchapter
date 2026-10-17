import { after, NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { archiveDeadPostings, closedSince, closeOpeningsQuietly, hotPostingUrls, moveLinks, stampVerified } from '@/lib/jobs/liveness-store'

export const maxDuration = 120

// The crawler's liveness pass (ncrawl/liveness.py, daily in weekly-sync.sh and 3-hourly in
// hot-sync.sh) reports here, so a dead job leaves the board within hours instead of at
// the next full import:
//
//   POST { closed: [url], verified: [{ url, at }], moved: [{ from, to, at }] }
//     closed   → archived with closeReason 'expired_checked'
//     verified → lastVerifiedAt (cards say "Last checked N days ago" past 3 days)
//     moved    → a live aggregator job re-listed under a new link
//   GET ?hot=N[&closedSince=ISO]
//     → { urls: the N highest-traffic live crawler jobs, closed: crawler jobs closed as
//         dead since then (the click-time check's closures, for the crawler to copy) }
//
// Same bearer as the import route (NC_ATS_API_KEY).

const MAX_ITEMS = 5000

function asDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { closed?: unknown; verified?: unknown; moved?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const now = new Date()
  const closed = (Array.isArray(body.closed) ? body.closed : []).filter((u): u is string => typeof u === 'string' && u.startsWith('http')).slice(0, MAX_ITEMS)
  const verified = (Array.isArray(body.verified) ? body.verified : [])
    .map((v) => ({ url: (v as { url?: unknown })?.url, at: asDate((v as { at?: unknown })?.at) }))
    .filter((v): v is { url: string; at: Date } => typeof v.url === 'string' && !!v.at && v.at <= now)
    .slice(0, MAX_ITEMS)
  const moved = (Array.isArray(body.moved) ? body.moved : [])
    .map((v) => ({ from: (v as { from?: unknown })?.from, to: (v as { to?: unknown })?.to, at: asDate((v as { at?: unknown })?.at) ?? now }))
    .filter((v): v is { from: string; to: string; at: Date } => typeof v.from === 'string' && typeof v.to === 'string' && v.to.startsWith('http'))
    .slice(0, MAX_ITEMS)

  const archived = await archiveDeadPostings({ urls: closed }, now)
  const stamped = await stampVerified(verified)
  const links = await moveLinks(moved)
  if (archived > 0 || links.collapsed > 0) after(closeOpeningsQuietly)
  return NextResponse.json({ archived, stamped, moved: links.moved, collapsed: links.collapsed })
}

export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const params = request.nextUrl.searchParams
  const hot = Math.min(Math.max(Number(params.get('hot') ?? 0) || 0, 0), 2000)
  const since = asDate(params.get('closedSince'))
  const [urls, closed] = await Promise.all([hot > 0 ? hotPostingUrls(hot) : Promise.resolve([]), since ? closedSince(since) : Promise.resolve([])])
  return NextResponse.json({ urls, closed })
}
