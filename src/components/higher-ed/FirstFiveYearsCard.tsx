import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { checkInMonthFrom } from '@/lib/higher-ed/services'
import { readProfile } from '@/lib/higher-ed/profile'
import { FirstFiveYearsView, fiveYearSteps } from './FirstFiveYears'

/** A recent graduate (the last five years) of a college, else null. */
export function isRecentGrad(m: { affiliation: string; classYear: number | null } | null | undefined, now = new Date()): m is { affiliation: string; classYear: number } {
  return !!m && m.affiliation === 'ALUM' && m.classYear !== null && m.classYear >= now.getUTCFullYear() - 5 && m.classYear <= now.getUTCFullYear()
}

// Reads: the member's early-career check-ins (at most 3), their open caseload assignment (1) and the institution row.
export async function FirstFiveYearsCard({ ctx, classYear }: { ctx: WorkspaceContext; classYear: number }) {
  if (!ctx.memberId) return null
  const [checkIns, advisor, inst] = await Promise.all([
    prisma.checkIn.findMany({ where: { memberId: ctx.memberId, kind: { in: ['M6', 'M18', 'M24'] } }, select: { kind: true, status: true }, take: 3 }),
    prisma.caseloadAssignment.findFirst({ where: { memberId: ctx.memberId, endedAt: null }, select: { counselor: { select: { fullName: true } } } }),
    prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { enabledFeatures: true, profile: true } }),
  ])
  const center = readProfile(inst?.profile).college?.careerCenter?.name ?? 'the career center'
  const helper = advisor?.counselor.fullName ? `Your advisor is ${advisor.counselor.fullName}, at ${center}.` : `Questions any time: ${center}.`
  return <FirstFiveYearsView college={ctx.institution.name} steps={fiveYearSteps(classYear, checkIns, checkInMonthFrom(inst?.enabledFeatures))} endsYear={classYear + 5} helper={helper} />
}
