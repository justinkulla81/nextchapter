// Resilience Fund (spec §5.3, HE-10): donors fund coaching for alumni in
// transition. Development records what was raised, awards coaching or a
// premium seat to an alum, and prints the donor report.

import 'server-only'
import type { FundAwardType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const AWARD_TYPES: { key: FundAwardType; label: string; defaultCents: number }[] = [
  { key: 'COACHING_PACKAGE', label: 'Coaching package', defaultCents: 75_000 },
  { key: 'PREMIUM_SEAT', label: 'Premium seat', defaultCents: 30_000 },
]

export async function activeFund(institutionId: string) {
  return prisma.resilienceFund.findFirst({
    where: { institutionId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, description: true, goalCents: true, raisedCents: true },
  })
}

export async function saveFund(institutionId: string, f: { name: string; description: string | null; goalCents: number; raisedCents: number }) {
  const existing = await activeFund(institutionId)
  return existing
    ? prisma.resilienceFund.update({ where: { id: existing.id }, data: f, select: { id: true } })
    : prisma.resilienceFund.create({ data: { institutionId, ...f }, select: { id: true } })
}

export async function awardFromFund(args: { institutionId: string; memberId: string; awardType: FundAwardType; valueCents: number; awardedBy: string }) {
  const fund = await activeFund(args.institutionId)
  if (!fund) return { error: 'Set up the fund first.' }
  const member = await prisma.institutionMember.findFirst({ where: { id: args.memberId, institutionId: args.institutionId }, select: { id: true } })
  if (!member) return { error: 'That alum isn’t on your roster.' }
  const open = await prisma.fundAward.findFirst({ where: { memberId: args.memberId, fundId: fund.id, status: 'AWARDED' }, select: { id: true } })
  if (open) return { error: 'They already have an award they haven’t used.' }
  const a = await prisma.fundAward.create({
    data: { fundId: fund.id, memberId: args.memberId, awardType: args.awardType, valueCents: args.valueCents, awardedBy: args.awardedBy },
    select: { id: true },
  })
  return { id: a.id }
}

export async function revokeAward(institutionId: string, awardId: string) {
  return prisma.fundAward.updateMany({ where: { id: awardId, status: 'AWARDED', fund: { institutionId } }, data: { status: 'REVOKED' } })
}

// The member side: an unused award shows as prepaid on their coaching.
export async function memberAward(memberId: string) {
  return prisma.fundAward.findFirst({
    where: { memberId, status: { in: ['AWARDED', 'REDEEMED'] } },
    orderBy: { awardedAt: 'desc' },
    select: { awardType: true, status: true, fund: { select: { name: true } } },
  })
}

export type DonorReport = {
  fund: { name: string; description: string | null; goalCents: number; raisedCents: number } | null
  awards: number
  awardedCents: number
  redeemed: number
  placed: number
  sharedStories: number
}

// Donors see what their money did: seats funded, alumni placed since their
// award, and how many chose to share their story. Counts only.
export async function donorReport(institutionId: string): Promise<DonorReport> {
  const fund = await activeFund(institutionId)
  if (!fund) return { fund: null, awards: 0, awardedCents: 0, redeemed: 0, placed: 0, sharedStories: 0 }
  const awards = await prisma.fundAward.findMany({
    where: { fundId: fund.id, status: { not: 'REVOKED' } },
    select: { memberId: true, valueCents: true, status: true, awardedAt: true },
  })
  let placed = 0
  let sharedStories = 0
  for (const a of awards) {
    const outcome = await prisma.outcomeReport.findFirst({
      where: { memberId: a.memberId, reportedAt: { gte: a.awardedAt } },
      select: { shareMilestone: true },
    })
    if (outcome) placed++
    if (outcome?.shareMilestone) sharedStories++
  }
  return {
    fund,
    awards: awards.length,
    awardedCents: awards.reduce((s, a) => s + a.valueCents, 0),
    redeemed: awards.filter((a) => a.status === 'REDEEMED').length,
    placed,
    sharedStories,
  }
}
