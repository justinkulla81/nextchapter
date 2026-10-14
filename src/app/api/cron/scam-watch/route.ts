import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 60

/**
 * Rapid-response pass for the fake-recruiter check.
 *
 * The hourly gmail-sync cron is the deep catch-up; waiting up to an hour to
 * hear "don't book that call" is too slow when a scam email says "book before
 * 9am." This runs every 10 minutes and only touches mailboxes that are already
 * caught up (a recent bookmark), so each pass lists a few minutes of new mail
 * and runs the normal sync on it — the scam check rides along on that sync
 * (see processMessage). Mailboxes that are far behind are left to the hourly
 * job so a backlog never eats this one's short time budget.
 */
export const GET = withCronRun('scam-watch', async () => {
  const started = Date.now()
  const deadline = started + 45_000
  const recentlySynced = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const connections = await prisma.emailConnection.findMany({
    where: { disconnectedAt: null, needsReconnectAt: null, lastSyncAt: { gte: recentlySynced } },
    orderBy: { lastSyncAt: 'asc' },
    select: { id: true },
  })

  let ran = 0
  for (const c of connections) {
    if (Date.now() > deadline) break
    try {
      if (await syncGmailConnection(c.id, { maxMessages: 100, deadline })) ran++
    } catch (error) {
      console.error('Scam-watch sync failed for connection', c.id, error)
    }
  }
  return NextResponse.json({ connections: connections.length, ran, ms: Date.now() - started })
})
