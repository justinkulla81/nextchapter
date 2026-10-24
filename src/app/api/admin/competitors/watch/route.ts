import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { digestOrder, EVENT_LABEL, type EventKind } from '@/lib/vision/competitor-watch-core'

export const maxDuration = 60

// What the competitors did since the last digest, for the daily digest to read. Same Bearer key as the other digest feeds.
//   ?mark=1   also mark the returned events as reported (only the digest should pass this)
export async function GET(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_ATS_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const events = await prisma.competitorEvent.findMany({
    where: { digestedAt: null }, orderBy: { createdAt: 'desc' }, take: 200, include: { competitor: { select: { id: true, name: true, relationship: true } } },
  })
  const pending = await prisma.competitorCellProposal.count({ where: { state: 'PENDING' } })
  if (request.nextUrl.searchParams.get('mark') === '1' && events.length) {
    await prisma.competitorEvent.updateMany({ where: { id: { in: events.map((e) => e.id) } }, data: { digestedAt: new Date() } })
  }
  const items = events
    .sort((a, b) => digestOrder(a.kind) - digestOrder(b.kind))
    .map((e) => ({
      competitor: e.competitor.name, relationship: e.competitor.relationship, kind: e.kind, label: EVENT_LABEL[e.kind as EventKind] ?? e.kind,
      title: e.title, summary: e.summary, url: e.url, amountUsd: e.amountUsd, occurredAt: e.occurredAt, source: e.source,
      cardUrl: 'https://launchyournextchapter.com/support/admin/vision/competitors',
    }))
  return NextResponse.json({ count: items.length, pendingMatrixProposals: pending, items })
}
