import 'server-only'
import { cookies } from 'next/headers'
import type { CandidateLeadSource, ReferralChannel, ReferrerKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export const REFERRAL_COOKIE = 'nc_ref'
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export const REFERRER_KIND_LABELS: Record<ReferrerKind, string> = {
  FOUNDER: 'Justin',
  COACH: 'Coach',
  RECRUITER: 'Recruiter',
  HIGHER_ED: 'Higher ed',
  EMPLOYER: 'Employer',
  CANDIDATE: 'Another candidate',
  OTHER: 'Someone else',
}
export const REFERRER_KINDS = Object.keys(REFERRER_KIND_LABELS) as ReferrerKind[]

// The lead source a given kind of recommender maps to.
const KIND_TO_LEAD_SOURCE: Record<ReferrerKind, CandidateLeadSource> = {
  FOUNDER: 'REFERRAL_ADMIN',
  COACH: 'COACH',
  RECRUITER: 'RECRUITER',
  HIGHER_ED: 'HIGHER_ED',
  EMPLOYER: 'REFERRAL_OTHER',
  CANDIDATE: 'REFERRAL_OTHER',
  OTHER: 'REFERRAL_OTHER',
}

export type ReferralInput = {
  candidateId: string
  kind: ReferrerKind
  channel: ReferralChannel
  setBy: string
  referrerName?: string | null
  referrerCrmPersonId?: string | null
  referrerCoachId?: string | null
  referrerRecruiterId?: string | null
  referrerCandidateId?: string | null
  referralLinkId?: string | null
  note?: string | null
}

/**
 * Records (or replaces) who recommended a candidate, and aligns the lead
 * source to match. `weakerThan` guards precedence: an automatic or
 * self-reported referral never overwrites one an admin set or a CRM invite
 * established.
 */
export async function recordReferral(input: ReferralInput): Promise<void> {
  const existing = await prisma.candidateReferral.findUnique({ where: { candidateId: input.candidateId }, select: { setBy: true } })
  if (existing && isStronger(existing.setBy, input.setBy)) return

  const data = {
    kind: input.kind,
    channel: input.channel,
    setBy: input.setBy,
    referrerName: input.referrerName ?? null,
    referrerCrmPersonId: input.referrerCrmPersonId ?? null,
    referrerCoachId: input.referrerCoachId ?? null,
    referrerRecruiterId: input.referrerRecruiterId ?? null,
    referrerCandidateId: input.referrerCandidateId ?? null,
    referralLinkId: input.referralLinkId ?? null,
    note: input.note ?? null,
  }
  await prisma.candidateReferral.upsert({
    where: { candidateId: input.candidateId },
    create: { candidateId: input.candidateId, ...data },
    update: data,
  })

  const source = KIND_TO_LEAD_SOURCE[input.kind]
  await prisma.candidateProfile.updateMany({
    where: { id: input.candidateId, OR: [{ leadSource: null }, { leadSourceSetBy: { in: ['auto', 'self'] } }] },
    data: { leadSource: source, leadSourceDetail: input.referrerName ?? null, leadSourceSetBy: input.setBy, leadSourceSetAt: new Date() },
  })
  captureServerEvent(input.candidateId, 'candidate_referral_recorded', { kind: input.kind, channel: input.channel, setBy: input.setBy })
}

// admin email / "invite" outrank "self" outrank "auto".
function rank(setBy: string): number {
  if (setBy === 'auto') return 1
  if (setBy === 'self') return 2
  return 3
}
function isStronger(existing: string, incoming: string): boolean {
  return rank(existing) > rank(incoming)
}

/**
 * Consumes the nc_ref cookie set by /api/r/<code> at registration, tagging
 * the new candidate with the link's owner. Best-effort: never throws.
 */
export async function applyReferralCookie(candidateId: string): Promise<boolean> {
  try {
    const code = (await cookies()).get(REFERRAL_COOKIE)?.value
    if (!code) return false
    const link = await prisma.referralLink.findUnique({
      where: { code },
      include: { ownerCrmPerson: { select: { fullName: true } } },
    })
    if (!link || !link.isActive) return false
    await recordReferral({
      candidateId,
      kind: link.kind,
      channel: 'INVITE_LINK',
      setBy: 'auto',
      referrerName: link.ownerCrmPerson?.fullName ?? link.label,
      referrerCrmPersonId: link.ownerCrmPersonId,
      referrerCoachId: link.ownerCoachId,
      referrerRecruiterId: link.ownerRecruiterId,
      referrerCandidateId: link.ownerCandidateId,
      referralLinkId: link.id,
    })
    return true
  } catch (error) {
    console.error('Failed to apply referral cookie:', error)
    return false
  }
}

/** Short random code for a new ReferralLink. */
export function newReferralCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}
