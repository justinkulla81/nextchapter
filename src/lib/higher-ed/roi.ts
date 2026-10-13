// ROI dashboard data (spec §7, HE-10). Gifts and join dates are the
// college's own records; "used the tools" comes from EngagementEvent, which
// only exists for alumni who share engagement, so the users group is
// consent-respecting by construction. Aggregates leave this file, never rows.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeRoi, fiscalYear, type FiscalYear, type Roi, type RoiRow } from './roi-math'

export function fiscalStartMonth(enabledFeatures: unknown): number {
  const v = (enabledFeatures as { fiscalYearStartMonth?: number } | null)?.fiscalYearStartMonth
  return v && v >= 1 && v <= 12 ? v : 7
}

export async function roiRows(institutionId: string, fy: FiscalYear, last: FiscalYear): Promise<RoiRow[]> {
  return prisma.$queryRaw<RoiRow[]>`
    with g as (
      select "memberId", "giftDate", "amountCents" from public."InstitutionGift"
      where "institutionId" = ${institutionId} and "memberId" is not null
    )
    select
      coalesce((floor(m."classYear" / 10) * 10)::int::text || 's', 'Unknown') as decade,
      (m.status in ('CLAIMED', 'ACTIVE')) as joined,
      m."claimedAt",
      exists (select 1 from public."EngagementEvent" e where e."memberId" = m.id
        and e.type in ('TOOL_USE', 'COACHING_SESSION', 'MENTOR_CALL') and e."occurredAt" >= ${fy.start} and e."occurredAt" < ${fy.end}) as "usedThisFy",
      exists (select 1 from g where g."memberId" = m.id and g."giftDate" >= ${fy.start} and g."giftDate" < ${fy.end}) as "gaveThisFy",
      exists (select 1 from g where g."memberId" = m.id and g."giftDate" >= ${last.start} and g."giftDate" < ${last.end}) as "gaveLastFy",
      exists (select 1 from g where g."memberId" = m.id and g."giftDate" < ${last.start}) as "gaveBeforeLastFy",
      (select min(g."giftDate") from g where g."memberId" = m.id) as "firstGiftAt",
      coalesce((select sum(g."amountCents") from g where g."memberId" = m.id and m."claimedAt" is not null
        and g."giftDate" >= m."claimedAt" and g."giftDate" >= ${fy.start} and g."giftDate" < ${fy.end}), 0)::int as "giftCentsAfterClaimThisFy",
      exists (select 1 from g where g."memberId" = m.id and m."claimedAt" is not null and g."giftDate" >= m."claimedAt"
        and g."giftDate" >= ${fy.start} and g."giftDate" < ${fy.end}) as "gaveThisFyAfterClaim"
    from public."InstitutionMember" m
    where m."institutionId" = ${institutionId} and m.affiliation in ('ALUM', 'STAFF_ALUM')`
}

export type RoiReport = { fy: FiscalYear; last: FiscalYear; roi: Roi; lastImportAt: Date | null; fund: { raisedCents: number; awards: number; awardedCents: number } }

// The current FY so far, or the one just closed (offset -1).
export async function roiReport(institutionId: string, now = new Date(), offset = 0): Promise<RoiReport> {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  const startMonth = fiscalStartMonth(inst.enabledFeatures)
  const fy = fiscalYear(now, startMonth, offset)
  const last = fiscalYear(now, startMonth, offset - 1)
  const [rows, run, funds, awards] = await Promise.all([
    roiRows(institutionId, fy, last),
    prisma.crmExchangeRun.findFirst({
      where: { institutionId, direction: 'IMPORT_GIFTS', status: { in: ['SUCCEEDED', 'PARTIAL'] } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    prisma.resilienceFund.aggregate({ where: { institutionId }, _sum: { raisedCents: true } }),
    prisma.fundAward.aggregate({ where: { fund: { institutionId }, status: { not: 'REVOKED' } }, _count: { _all: true }, _sum: { valueCents: true } }),
  ])
  return {
    fy,
    last,
    roi: computeRoi(rows),
    lastImportAt: run?.completedAt ?? null,
    fund: { raisedCents: funds._sum.raisedCents ?? 0, awards: awards._count._all, awardedCents: awards._sum.valueCents ?? 0 },
  }
}
