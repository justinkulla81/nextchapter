import 'server-only'
import { prisma } from '@/lib/prisma'
import { hunterAccount, hunterConfigured, hunterVerifyEmail } from '@/lib/crm/hunter'

/** Most addresses checked in one run, and verifications always left for the cold-outreach sender, which checks each first email. */
export const VERIFY_PER_RUN = 100
export const VERIFY_RESERVE = 300
const TIME_LIMIT_MS = 200_000
const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 }

/** The same reading of Hunter's verdict the cold-outreach sender uses. */
export function statusFromHunter(status: string): 'deliverable' | 'invalid' | 'risky' {
  if (status === 'valid') return 'deliverable'
  if (status === 'invalid' || status === 'disposable') return 'invalid'
  return 'risky'
}

export interface VerifyResult {
  checked: number
  deliverable: number
  invalid: number
  risky: number
  /** Active list addresses still never checked. */
  remaining: number
  stoppedBecause: 'done' | 'cap' | 'reserve' | 'time' | 'not_configured' | 'hunter_error'
  verificationsLeft: number | null
}

/**
 * Checks addresses on the active mailing lists that Hunter has never looked at, P0 first, then P1, P2 and the rest.
 * Metered: each address is one verification credit. Stops at the per-run cap, when the account is down to the reserve, or at the time limit.
 * An address Hunter calls invalid is suppressed on every list by the next clean-up (pruneLists).
 */
export async function verifyListMembers(opts: { max?: number; reserve?: number } = {}): Promise<VerifyResult> {
  const max = opts.max ?? VERIFY_PER_RUN
  const reserve = opts.reserve ?? VERIFY_RESERVE
  const out: VerifyResult = { checked: 0, deliverable: 0, invalid: 0, risky: 0, remaining: 0, stoppedBecause: 'done', verificationsLeft: null }
  if (!hunterConfigured()) return { ...out, stoppedBecause: 'not_configured' }

  const rows = await prisma.mailingListMember.findMany({
    where: { status: 'ACTIVE', person: { deletedAt: null, email: { not: null }, emailVerifiedStatus: null } },
    select: { personId: true, email: true, person: { select: { email: true, priority: true } } },
    distinct: ['personId'],
  })
  // Only the address the person is mailed at; a list row on an older address is cleaned up elsewhere.
  const todo = rows
    .filter((r) => r.personId && r.person?.email && r.person.email.trim().toLowerCase() === r.email)
    .sort((a, b) => (PRIORITY_ORDER[a.person?.priority ?? ''] ?? 3) - (PRIORITY_ORDER[b.person?.priority ?? ''] ?? 3))
  out.remaining = todo.length
  if (todo.length === 0) return out

  let left: number
  try {
    const acct = await hunterAccount()
    if (!acct) return { ...out, stoppedBecause: 'hunter_error' }
    left = acct.requests.verifications.available - acct.requests.verifications.used
  } catch {
    return { ...out, stoppedBecause: 'hunter_error' }
  }
  out.verificationsLeft = left
  const budget = Math.min(max, left - reserve)
  if (budget <= 0) return { ...out, stoppedBecause: 'reserve' }

  const started = Date.now()
  let failures = 0
  for (const r of todo) {
    if (out.checked >= budget) { out.stoppedBecause = 'cap'; break }
    if (Date.now() - started > TIME_LIMIT_MS) { out.stoppedBecause = 'time'; break }
    const v = await hunterVerifyEmail(r.email).catch(() => { failures += 3; return null })
    if (!v) { if (++failures >= 5) { out.stoppedBecause = 'hunter_error'; break } continue }
    const status = statusFromHunter(v.status)
    await prisma.crmPerson.update({ where: { id: r.personId! }, data: { emailVerifiedStatus: status, emailVerifiedAt: new Date() } })
    out.checked++
    out[status]++
    out.remaining--
  }
  if (out.verificationsLeft !== null) out.verificationsLeft -= out.checked
  return out
}
