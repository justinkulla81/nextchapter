// "I'm in transition" / "I got a job" and the do-not-solicit lifecycle
// (spec §6.3, HE-06):
//
//   (none) → IN_TRANSITION (do-not-solicit on)
//   IN_TRANSITION → PLACED_GRACE on "I got a job" (still do-not-solicit,
//                   graceEndsAt = placedAt + graceDays)
//   PLACED_GRACE → CLEARED by the nightly job once grace ends (solicitable)
//   any open flag → CLEARED when the member closes it themselves
//
// When a flag clears and the member said the college helped, the gratitude
// ask becomes PENDING for Development to approve. Never a raw WARN match.

import 'server-only'
import type { TransitionFlagSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'

const DAY = 86_400_000

export function graceDaysFrom(enabledFeatures: unknown): number {
  const v = (enabledFeatures as { graceDays?: number } | null)?.graceDays
  return typeof v === 'number' && v >= 0 && v <= 365 ? v : 60
}

export function graceEndsAt(placedAt: Date, graceDays: number): Date {
  return new Date(placedAt.getTime() + graceDays * DAY)
}

export async function openTransitionFlag(memberId: string, source: TransitionFlagSource): Promise<{ id: string; created: boolean }> {
  const open = await prisma.transitionFlag.findUnique({ where: { openFlagMemberId: memberId }, select: { id: true } })
  if (open) return { id: open.id, created: false }
  const flag = await prisma.transitionFlag.create({
    data: { memberId, openFlagMemberId: memberId, source, state: 'IN_TRANSITION', doNotSolicit: true },
    select: { id: true },
  })
  return { id: flag.id, created: true }
}

export async function closeTransitionFlag(memberId: string): Promise<boolean> {
  const r = await prisma.transitionFlag.updateMany({
    where: { openFlagMemberId: memberId },
    data: { state: 'CLEARED', clearedAt: new Date(), doNotSolicit: false, openFlagMemberId: null },
  })
  return r.count > 0
}

// "I got a job": the new job becomes the member's current NextChapter
// employment, an OutcomeReport records whether the college helped, and an
// open flag moves to its grace period.
export async function reportNewJob(args: {
  memberId: string
  candidateId: string
  companyName: string
  title: string
  startDate: Date | null
  helpedByInstitution: boolean | null
  shareMilestone: boolean
  graceDays: number
  now?: Date
}): Promise<{ outcomeReportId: string; flagMoved: boolean }> {
  const now = args.now ?? new Date()
  const company = await getOrCreateCompany(args.companyName)
  const previous = await prisma.memberEmployment.findFirst({ where: { candidateId: args.candidateId, isCurrent: true }, select: { companyId: true } })
  await prisma.memberEmployment.updateMany({ where: { candidateId: args.candidateId, isCurrent: true }, data: { isCurrent: false } })
  const employment = await prisma.memberEmployment.upsert({
    where: { candidateId_companyId: { candidateId: args.candidateId, companyId: company.id } },
    create: { candidateId: args.candidateId, companyId: company.id, title: args.title, startDate: args.startDate, isCurrent: true },
    update: { title: args.title, startDate: args.startDate, isCurrent: true, endDate: null },
    select: { id: true },
  })
  const report = await prisma.outcomeReport.create({
    data: {
      memberId: args.memberId,
      memberEmploymentId: employment.id,
      helpedByInstitution: args.helpedByInstitution,
      shareMilestone: args.shareMilestone,
      reportedAt: now,
    },
    select: { id: true },
  })
  const moved = await prisma.transitionFlag.updateMany({
    where: { openFlagMemberId: args.memberId, state: 'IN_TRANSITION' },
    data: { state: 'PLACED_GRACE', placedAt: now, graceEndsAt: graceEndsAt(now, args.graceDays) },
  })
  await raiseProspectSignals({
    memberId: args.memberId,
    employmentId: employment.id,
    title: args.title,
    newEmployer: previous?.companyId !== company.id,
  })
  return { outcomeReportId: report.id, flagMoved: moved.count > 0 }
}

// Nightly (and the demo's "advance time"): clear flags whose grace has ended
// and queue the gratitude ask where the member said the college helped.
// Idempotent: a cleared flag is never touched again.
export async function clearEndedGrace(now = new Date(), institutionId?: string): Promise<{ cleared: number; gratitudePending: number }> {
  const due = await prisma.transitionFlag.findMany({
    where: {
      state: 'PLACED_GRACE',
      graceEndsAt: { lte: now },
      ...(institutionId ? { member: { institutionId } } : {}),
    },
    select: { id: true, memberId: true },
  })
  let gratitudePending = 0
  for (const f of due) {
    await prisma.transitionFlag.update({
      where: { id: f.id },
      data: { state: 'CLEARED', clearedAt: now, doNotSolicit: false, openFlagMemberId: null },
    })
    const latest = await prisma.outcomeReport.findFirst({
      where: { memberId: f.memberId },
      orderBy: { reportedAt: 'desc' },
      select: { id: true, helpedByInstitution: true, gratitudeStatus: true },
    })
    if (latest?.helpedByInstitution && latest.gratitudeStatus === 'NONE') {
      await prisma.outcomeReport.update({ where: { id: latest.id }, data: { gratitudeStatus: 'PENDING' } })
      gratitudePending++
    }
  }
  return { cleared: due.length, gratitudePending }
}

// A member reported landing without the job details (a check-in answer): the
// open flag still moves to its grace period. "I got a job" with details uses
// reportNewJob instead.
export async function placeOpenFlag(memberId: string, graceDays: number, now = new Date()): Promise<boolean> {
  const r = await prisma.transitionFlag.updateMany({
    where: { openFlagMemberId: memberId, state: 'IN_TRANSITION' },
    data: { state: 'PLACED_GRACE', placedAt: now, graceEndsAt: graceEndsAt(now, graceDays) },
  })
  return r.count > 0
}

// VP and above (spec §6.4): VP, SVP, EVP, Chief / C-suite, President, Head of.
export function isVpPlus(title: string): boolean {
  return /\b(vp|svp|evp|vice president|chief|president|head of|c[eiofmt]o)\b/i.test(title)
}

// Development's signals from a reported job (spec §6.4): a VP-and-up title,
// and any new employer (worth a matching-gift check). Only for members who
// share job news with the college; idempotent on (member, type, job).
async function raiseProspectSignals(args: { memberId: string; employmentId: string; title: string; newEmployer: boolean }) {
  const [consent] = await prisma.$queryRaw<{ shareOutcome: boolean; institutionId: string }[]>`
    select "shareOutcome", "institutionId" from private.v_member_consent where "memberId" = ${args.memberId}`
  if (!consent?.shareOutcome) return
  const types = [...(isVpPlus(args.title) ? (['PROMOTION_VP_PLUS'] as const) : []), ...(args.newEmployer ? (['NEW_EMPLOYER_MATCHING_GIFT'] as const) : [])]
  if (!types.length) return
  await prisma.prospectFlag.createMany({
    data: types.map((type) => ({ institutionId: consent.institutionId, memberId: args.memberId, type, sourceMemberEmploymentId: args.employmentId })),
    skipDuplicates: true,
  })
}
