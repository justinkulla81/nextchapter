import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { importAppearances, parseAppearances } from '@/lib/speaking/voices'
import { syncSpeakingTasks } from '@/lib/speaking/sync'
import { captureServerEvent } from '@/lib/posthog/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'

export const maxDuration = 60
const MAX = 150

const authed = (r: NextRequest) => isBearerAuthorized(r.headers.get('authorization'), process.env.NC_ATS_API_KEY)

// GET (Bearer): the voices to check this week, least recently checked first, with what we already hold so the search skips it.
export async function GET(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ version: 1 })
  const voices = await prisma.speakerWatch.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ lastCheckedAt: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    select: { name: true, org: true, title: true, topics: true, lastCheckedAt: true, appearances: { select: { eventName: true, url: true, eventDate: true }, orderBy: { eventDate: 'desc' }, take: 8 } },
  })
  return NextResponse.json({ version: 1, voices })
}

// POST (Bearer): appearances found for watched voices, new voices the search suggests, and which voices it checked.
// Re-posting is harmless: each appearance is keyed on speaker + link.
export async function POST(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 }) }
  const { appearances, suggested, checked, errors } = parseAppearances(body)
  if (appearances.length > MAX) return NextResponse.json({ error: `Send at most ${MAX} appearances per request` }, { status: 400 })
  const dryRun = (body as { dryRun?: unknown }).dryRun === true
  const result = await importAppearances(appearances, suggested, checked, dryRun)
  const tasks = dryRun ? { opened: 0, closed: 0 } : await syncSpeakingTasks()
  if (!dryRun) captureServerEvent('speaker-watch', 'speaker_appearances_imported', { received: appearances.length, rejected: errors.length, ...result, tasksOpened: tasks.opened })
  return NextResponse.json({ dryRun, ...result, tasksOpened: tasks.opened, errors })
}
