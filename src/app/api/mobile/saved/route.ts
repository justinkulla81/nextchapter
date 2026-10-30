import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { mobileUserId } from '@/lib/mobile/auth'
import { cleanPublicQuery } from '@/lib/jobs/public-board'

const MAX_SAVED = 25

// Saved searches and saved employers for the signed-in app user. Signing in is the only place the app asks for an account.
// kind 'jobs' pushes new matching jobs; kind 'employer' pushes a new layoff filing at that employer.
async function guard(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  if (!(await allowByIp('mobile-saved', 120, HOUR_MS))) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  const userId = await mobileUserId(request)
  return userId ? { userId } : NextResponse.json({ error: 'Sign in to save.' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const g = await guard(request)
  if (g instanceof NextResponse) return g
  try {
    const items = await prisma.mobileSavedSearch.findMany({ where: { userId: g.userId }, orderBy: { createdAt: 'desc' }, take: MAX_SAVED })
    return NextResponse.json({ items })
  } catch (e) {
    console.error('mobile saved list failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ items: [] })
  }
}

export async function POST(request: NextRequest) {
  const g = await guard(request)
  if (g instanceof NextResponse) return g
  const b = (await request.json().catch(() => null)) as { kind?: unknown; q?: unknown; loc?: unknown; remote?: unknown; minPay?: unknown } | null
  const kind = b?.kind === 'employer' ? 'employer' : b?.kind === 'jobs' ? 'jobs' : ''
  if (!kind) return NextResponse.json({ error: 'kind must be jobs or employer.' }, { status: 400 })
  const clean = cleanPublicQuery({ q: typeof b?.q === 'string' ? b.q : '', loc: typeof b?.loc === 'string' ? b.loc : '', remote: b?.remote === true ? '1' : '' })
  if (kind === 'employer' && clean.q.length < 2) return NextResponse.json({ error: 'Enter an employer name.' }, { status: 400 })
  const minPay = typeof b?.minPay === 'number' && b.minPay > 0 && b.minPay <= 1_000_000 ? Math.round(b.minPay) : 0
  const data = { userId: g.userId, kind, q: clean.q.toLowerCase(), loc: kind === 'jobs' ? clean.loc.toLowerCase() : '', remote: kind === 'jobs' && clean.remote, minPay: kind === 'jobs' ? minPay : 0 }
  try {
    if ((await prisma.mobileSavedSearch.count({ where: { userId: g.userId } })) >= MAX_SAVED) return NextResponse.json({ error: `You can save up to ${MAX_SAVED}. Remove one first.` }, { status: 409 })
    const item = await prisma.mobileSavedSearch.upsert({ where: { userId_kind_q_loc_remote_minPay: data }, create: data, update: {} })
    captureServerEvent(g.userId, 'mobile_search_saved', { kind, q: data.q, loc: data.loc, remote: data.remote, minPay })
    return NextResponse.json({ item })
  } catch (e) {
    console.error('mobile saved create failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not save right now.' }, { status: 503 })
  }
}

export async function DELETE(request: NextRequest) {
  const g = await guard(request)
  if (g instanceof NextResponse) return g
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })
  try {
    await prisma.mobileSavedSearch.deleteMany({ where: { id, userId: g.userId } })
    captureServerEvent(g.userId, 'mobile_search_removed', { id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('mobile saved delete failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not remove right now.' }, { status: 503 })
  }
}
