import 'server-only'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/security/token-crypto'
import { captureServerEvent } from '@/lib/posthog/server'
import { AUTOPOST_CREDIBILITY, AUTOPOST_MAX_LATE_MS, AUTOPOST_MIN_GAP_MS, dueForAutoPost } from './layoff-post-rules'
import { publishDraftAsPage } from './draft-publish'
import { postUrl } from './page-posting'

/** Warn this many days before the connection's token lapses (LinkedIn issues no refresh token, so it has to be reconnected). */
const EXPIRY_WARNING_DAYS = 7

export interface ScheduledPostResult {
  status: 'off' | 'not-connected' | 'nothing-due' | 'too-soon' | 'posted' | 'failed'
  postedDraftId?: string
  url?: string
  error?: string
  /** Days left on the page connection when it is close to lapsing. */
  connectionDaysLeft?: number
}

/** The live company-page connection, whichever admin made it: the newest one that is connected, unexpired and for a page. */
async function pageConnection() {
  const c = await prisma.linkedInAdminConnection.findFirst({
    where: { disconnectedAt: null, organizationUrn: { not: null }, expiresAt: { gt: new Date() } },
    orderBy: { connectedAt: 'desc' },
  })
  return c && c.organizationUrn ? { accessToken: decryptToken(c.accessToken), organizationUrn: c.organizationUrn, expiresAt: c.expiresAt } : null
}

/**
 * Posts the next due draft as the NextChapter page, without a click. Runs from the hourly layoff-news cron
 * (the project is at Vercel's cron limit), so a draft due at 8:15 ET goes out at 8:20.
 *
 * Off unless LINKEDIN_AUTOPOST=on. One post per run and none within six hours of another post. Only drafts from a
 * state WARN filing or an SEC filing; news-sourced drafts stay for a person. A draft more than a day past its slot
 * is left alone. A failure puts the draft back and the next run tries again until it goes stale.
 */
export async function runScheduledLinkedInPosting(now = new Date()): Promise<ScheduledPostResult> {
  if (process.env.LINKEDIN_AUTOPOST !== 'on') return { status: 'off' }
  const conn = await pageConnection()
  if (!conn) {
    captureServerEvent('cron', 'linkedin_autopost_not_connected', {})
    return { status: 'not-connected' }
  }
  const daysLeft = Math.floor((conn.expiresAt.getTime() - now.getTime()) / 86_400_000)
  const connectionDaysLeft = daysLeft <= EXPIRY_WARNING_DAYS ? daysLeft : undefined
  if (connectionDaysLeft !== undefined) captureServerEvent('cron', 'linkedin_connection_expiring', { daysLeft: connectionDaysLeft })

  const recent = await prisma.linkedInPostDraft.findFirst({ where: { status: 'POSTED', postedAt: { gt: new Date(now.getTime() - AUTOPOST_MIN_GAP_MS) } }, select: { id: true } })
  if (recent) return { status: 'too-soon', connectionDaysLeft }

  const candidates = await prisma.linkedInPostDraft.findMany({
    where: {
      status: 'DRAFT', postUrn: null, credibility: { in: [...AUTOPOST_CREDIBILITY] },
      scheduledFor: { lte: now, gte: new Date(now.getTime() - AUTOPOST_MAX_LATE_MS) },
      notice: { dismissedAt: null },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 5,
    select: { id: true, status: true, credibility: true, scheduledFor: true, postUrn: true },
  })
  const due = candidates.find((d) => dueForAutoPost(d, now))
  if (!due) return { status: 'nothing-due', connectionDaysLeft }

  const r = await publishDraftAsPage(due.id, conn)
  if (!r.ok) {
    if (r.reason === 'failed') captureServerEvent('cron', 'linkedin_draft_post_failed', { draftId: due.id, error: r.error, source: 'schedule' })
    return { status: r.reason === 'failed' ? 'failed' : 'nothing-due', error: r.error, connectionDaysLeft }
  }
  captureServerEvent('cron', 'linkedin_draft_auto_posted', {
    draftId: due.id, angle: r.angle, credibility: r.credibility, as: 'page', commented: r.commented, source: 'schedule',
    minutesFromSlot: Math.round((now.getTime() - due.scheduledFor.getTime()) / 60000),
  })
  return { status: 'posted', postedDraftId: due.id, url: postUrl(r.postUrn), connectionDaysLeft }
}
