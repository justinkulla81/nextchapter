import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'

export const maxDuration = 300

/**
 * Hourly background Gmail sync for every connected candidate.
 *
 * The sync used to run only when a candidate opened a dashboard page, so
 * mail from a week away sat unread until they came back — and then had to
 * be caught up inside a single page request. This walks each connection
 * forward from its own bookmark (see syncGmailConnection); a mailbox that's
 * behind catches up across successive runs rather than in one.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  // Leave headroom under maxDuration for the day in flight to finish.
  const deadline = started + 220_000
  const connections = await prisma.emailConnection.findMany({
    where: { disconnectedAt: null, needsReconnectAt: null },
    // The furthest-behind mailbox first, so a backlog is never starved.
    orderBy: { lastSyncAt: { sort: 'asc', nulls: 'first' } },
    select: { id: true },
  })

  const results: { id: string; synced: number; caughtUp?: boolean }[] = []
  for (const c of connections) {
    if (Date.now() > deadline) break
    try {
      const r = await syncGmailConnection(c.id, { maxMessages: 2000, ignoreThrottle: true, deadline })
      if (r) results.push({ id: c.id, ...r })
    } catch (error) {
      console.error('Background Gmail sync failed for connection', c.id, error)
    }
  }
  return NextResponse.json({ connections: connections.length, ran: results.length, results, ms: Date.now() - started })
}
