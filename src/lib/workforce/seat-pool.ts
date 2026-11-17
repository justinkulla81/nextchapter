import 'server-only'
import { prisma } from '@/lib/prisma'
import { planOf } from '@/lib/plans/entitlements'

// Seats left in an organization's layoff seat pool, or null when there is no limit. On the free plan anyone can join
// (owner decision 2026-11-17), so seats given to member companies are not counted against a pool.
export async function seatPoolLeft(institutionId: string): Promise<number | null> {
  const [inst, given] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { includedSeats: true, plan: true } }),
    prisma.rapidResponse.aggregate({ where: { institutionId, isActive: true, memberCompanyId: { not: null } }, _sum: { seats: true } }),
  ])
  if (planOf(inst.plan) === 'FREE') return null
  return inst.includedSeats - (given._sum.seats ?? 0)
}
