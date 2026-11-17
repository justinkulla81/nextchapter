'use server'

import { allowByIp, allowByTarget, DAY_MS, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { COMMITMENT_KEYS, canClaim, domainMatches, isPlausibleInviteToken, normalizeCommitments } from '@/lib/workforce/ecosystem'

type Result = { error?: string; ok?: boolean }

// A partner asks to join the talent network from an invitation link. No account, no access: it only records a request the steward
// confirms or declines. Rate limited by network and by email.
export async function submitPartnerClaim(slug: string, token: string, _prev: Result | undefined, f: FormData): Promise<Result> {
  if (!isPlausibleInviteToken(token)) return { error: 'This link is not valid.' }
  if (String(f.get('website2') ?? '') !== '') return { ok: true } // a field people cannot see: a bot filled it
  const name = String(f.get('name') ?? '').trim().slice(0, 120)
  const title = String(f.get('title') ?? '').trim().slice(0, 120)
  const email = String(f.get('email') ?? '').trim().toLowerCase().slice(0, 200)
  const note = String(f.get('note') ?? '').trim().slice(0, 1000)
  if (!name) return { error: 'Add your name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Add a work email we can reach you at.' }
  if (!(await allowByIp('partner-claim', 10, HOUR_MS)) || !(await allowByTarget('partner-claim-email', email, 5, DAY_MS))) return { error: RATE_LIMITED_MESSAGE }
  const p = await prisma.ecosystemPartner.findUnique({ where: { inviteToken: token }, select: { id: true, status: true, website: true, kind: true, institution: { select: { id: true, slug: true } } } }).catch(() => null)
  if (!p || p.institution.slug !== slug) return { error: 'This link is not valid.' }
  if (!canClaim(p.status)) return { error: 'This invitation is no longer open. Ask the organization that sent it for a new one.' }
  const commitments = normalizeCommitments(f.getAll('commitments').map(String).filter((c) => COMMITMENT_KEYS.includes(c)))
  await prisma.ecosystemPartner.update({
    where: { id: p.id },
    data: { status: 'CLAIMED', claimName: name, claimTitle: title || null, claimEmail: email, claimNote: note || null, emailDomainMatch: domainMatches(email, p.website), commitments, claimedAt: new Date() },
  })
  captureServerEvent(`partner-invite:${p.id}`, 'ecosystem_claim_submitted', { institutionId: p.institution.id, partnerId: p.id, kind: p.kind, commitments, domainMatch: domainMatches(email, p.website) })
  return { ok: true }
}
