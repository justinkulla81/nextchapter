import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { signDigestAction, PAUSE_DAYS } from '@/lib/crm/digest-action-link'

const MAX_PEOPLE = 200
const ORIGIN = 'https://launchyournextchapter.com'

// The daily digest asks for one-click Done / Pause links for the follow-ups it
// lists. Only people who have a follow-up date get links: the link acts on
// that date, so a person without one has nothing to finish or push out.
export function GET() {
  return NextResponse.json({ version: 1, pauseDays: PAUSE_DAYS })
}

export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON: { personIds: string[] }' }, { status: 400 })
  }
  const ids = (body as { personIds?: unknown }).personIds
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) {
    return NextResponse.json({ error: 'personIds must be an array of strings' }, { status: 400 })
  }
  if (ids.length > MAX_PEOPLE) return NextResponse.json({ error: `Send at most ${MAX_PEOPLE} ids` }, { status: 400 })

  const people = await prisma.crmPerson.findMany({
    where: { id: { in: ids as string[] }, deletedAt: null, nextFollowUpAt: { not: null } },
    select: { id: true, nextFollowUpAt: true },
  })
  const links: Record<string, { done: string; pause: string }> = {}
  for (const p of people) {
    const done = signDigestAction(p.id, 'done', p.nextFollowUpAt!)
    const pause = signDigestAction(p.id, 'pause', p.nextFollowUpAt!)
    if (done && pause) {
      links[p.id] = {
        done: `${ORIGIN}/api/crm/digest-action/${done}`,
        pause: `${ORIGIN}/api/crm/digest-action/${pause}`,
      }
    }
  }
  const noFollowUp = (ids as string[]).filter((id) => !links[id])
  return NextResponse.json({ links, noFollowUp })
}
