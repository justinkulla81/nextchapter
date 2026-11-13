import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { hunterAccount, hunterConfigured, hunterVerifyEmail } from '@/lib/crm/hunter'
import { statusFromHunter } from '@/lib/mailing/verify-members'
import { HUNTER_FRESH_DAYS } from './quality'

/** Verifications always left in the Hunter account (mailing-verify keeps 300 for the cold-outreach sender; this keeps a little more). */
export const VERIFY_FLOOR = 350
/** Most addresses the layoff outreach checks in a day, so a bug or a flood of directory addresses cannot drain the account. */
export const VERIFY_DAILY_MAX = 600
const CONCURRENCY = 5

export interface EnsureResult { checked: number; stopped: 'done' | 'cap' | 'time' | 'floor' | 'daily' | 'not_configured' | 'hunter_error' }

/**
 * Has Hunter check each address that has no recent check (one verification credit each) and saves the answer in AddressVerification, so the
 * layoff outreach can email a directory contact only once Hunter calls it deliverable (quality.ts). Stops at `max`, at `timeMs`, at the daily
 * ceiling, or when the account is down to VERIFY_FLOOR. An address Hunter cannot decide is left unsaved and tried again later.
 */
export async function ensureVerified(emails: string[], opts: { max: number; timeMs: number }): Promise<EnsureResult> {
  const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (wanted.length === 0) return { checked: 0, stopped: 'done' }
  if (!hunterConfigured()) return { checked: 0, stopped: 'not_configured' }
  const fresh = new Date(Date.now() - HUNTER_FRESH_DAYS * 86_400_000)
  const have = new Set((await prisma.addressVerification.findMany({ where: { email: { in: wanted }, checkedAt: { gte: fresh } }, select: { email: true } })).map((r) => r.email))
  const todo = wanted.filter((e) => !have.has(e))
  if (todo.length === 0) return { checked: 0, stopped: 'done' }
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0)
  const usedToday = await prisma.addressVerification.count({ where: { checkedAt: { gte: dayStart }, source: 'layoff-outreach' } })
  let left: number
  try {
    const acct = await hunterAccount()
    if (!acct) return { checked: 0, stopped: 'hunter_error' }
    left = acct.requests.verifications.available - acct.requests.verifications.used
  } catch {
    return { checked: 0, stopped: 'hunter_error' }
  }
  const allowed = Math.min(opts.max, left - VERIFY_FLOOR, VERIFY_DAILY_MAX - usedToday)
  if (allowed <= 0) return { checked: 0, stopped: left - VERIFY_FLOOR <= 0 ? 'floor' : usedToday >= VERIFY_DAILY_MAX ? 'daily' : 'cap' }

  const queue = todo.slice(0, allowed)
  const end = Date.now() + opts.timeMs
  let checked = 0
  let stopped: EnsureResult['stopped'] = queue.length < todo.length ? 'cap' : 'done'
  const counts = { deliverable: 0, risky: 0, invalid: 0 }
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length && stopped !== 'hunter_error') {
      if (Date.now() > end) { stopped = 'time'; return }
      const email = queue.shift()!
      try {
        const r = await hunterVerifyEmail(email)
        if (!r) continue
        const status = statusFromHunter(r.status)
        await prisma.addressVerification.upsert({
          where: { email }, update: { status, hunterStatus: r.status, score: r.score, checkedAt: new Date(), source: 'layoff-outreach' },
          create: { email, status, hunterStatus: r.status, score: r.score, source: 'layoff-outreach' },
        })
        counts[status]++
        checked++
      } catch {
        stopped = 'hunter_error'
      }
    }
  }))
  if (checked) captureServerEvent('system', 'layoff_outreach_verified', { checked, ...counts, stopped })
  return { checked, stopped }
}
