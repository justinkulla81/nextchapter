import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { withCronRun } from '@/lib/cron/run'
import { isGmailPushConfigured, needsPushWatch, startGmailWatch } from '@/lib/email-tracking/gmail-push'

export const maxDuration = 120

/**
 * Rapid-response pass for the fake-recruiter check.
 *
 * The hourly gmail-sync cron is the deep catch-up; waiting up to an hour to
 * hear "don't book that call" is too slow when a scam email says "book before
 * 9am." This runs every 10 minutes and only touches mailboxes that are already
 * caught up (a recent bookmark), so each pass lists a few minutes of new mail
 * and runs the normal sync on it — the scam check rides along on that sync
 * (see processMessage). When Gmail push is configured (gmail-push.ts), the
 * same sync is also triggered within seconds of new mail by the
 * /api/google/gmail-push webhook, and this job keeps the watches alive. Mailboxes that are far behind are left to the hourly
 * job so a backlog never eats this one's short time budget.
 */
const TIMED_OUT = Symbol('timed out')
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ms) })
  // The abandoned promise may still reject later; that must not become an unhandled rejection.
  work.catch(() => {})
  try { return await Promise.race([work, timeout]) } finally { clearTimeout(timer) }
}

export const GET = withCronRun('scam-watch', async () => {
  const started = Date.now()
  // 30 seconds under the 120-second limit: Gmail retries wait only while they fit before this (gmail-api.ts backoff), and the
  // last step of a pass (saving the bookmark, the run record) needs the rest.
  const deadline = started + 70_000
  // A single slow mailbox (a hung Gmail or scam-check call) used to run the whole function into its limit, which left the run
  // "cut off" and emailed an alert every few times a day. Each step now gives up at HARD_STOP and the run finishes normally; the
  // sync bookmark only moves once a day is fully processed, so an abandoned mailbox is simply picked up on the next pass.
  const HARD_STOP = started + 100_000
  const recentlySynced = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  const connections = await prisma.emailConnection.findMany({
    where: { disconnectedAt: null, needsReconnectAt: null, lastSyncAt: { gte: recentlySynced } },
    orderBy: { lastSyncAt: 'asc' },
    select: { id: true },
  })

  // With push configured, this also (re)starts Google's watch on every
  // mailbox that lacks one or is about to lose it. Push makes alerts near
  // instant; the sync loop below remains the fallback if a push is missed.
  let watched = 0
  if (isGmailPushConfigured()) {
    const toWatch = await prisma.emailConnection.findMany({ where: { disconnectedAt: null, needsReconnectAt: null } })
    for (const c of toWatch) {
      if (Date.now() > deadline - 20_000) break
      if (needsPushWatch(c) && (await withTimeout(startGmailWatch(c), 10_000)) === true) watched++
    }
  }

  let ran = 0
  let abandoned = 0
  for (const c of connections) {
    if (Date.now() > deadline) break
    try {
      const left = HARD_STOP - Date.now()
      if (left <= 0) break
      const result = await withTimeout(syncGmailConnection(c.id, { maxMessages: 100, deadline }), left)
      if (result === TIMED_OUT) {
        abandoned++
        break
      }
      if (result) ran++
    } catch (error) {
      console.error('Scam-watch sync failed for connection', c.id, error)
    }
  }
  return NextResponse.json({ connections: connections.length, ran, watched, abandoned, ms: Date.now() - started })
})
