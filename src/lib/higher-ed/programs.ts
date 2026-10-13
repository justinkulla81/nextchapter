// V2 programs (spec §13), lean: Exec Ed runs programs in cohorts, alumni
// apply, staff enroll and record who pays, completers earn the program's
// credential. Corporate clients buy seats; employers sponsor capstones that
// Teaching approves; the Workforce board sees WIOA-funded participants.
// "Placed" is never typed in: it's an OutcomeReport after completion.

import 'server-only'
import type { CapstoneStatus, EnrollmentStatus, ProgramPayer } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const DAY = 86_400_000
// WIOA counts employment in the second quarter after exit; we use 180 days.
export const PLACEMENT_WINDOW_DAYS = 180

export const PAYER_LABELS: Record<ProgramPayer, string> = {
  SELF_PAY: 'Self-pay',
  EMPLOYER: 'Employer',
  RESILIENCE_FUND: 'Resilience Fund',
  WIOA_VOUCHER: 'WIOA voucher',
  BOARD_CONTRACT: 'Workforce board contract',
  PELL: 'Pell grant',
}
export const STATUS_LABELS: Record<EnrollmentStatus, string> = { APPLIED: 'Applied', ENROLLED: 'Enrolled', COMPLETED: 'Completed', WITHDREW: 'Withdrew' }
export const CAPSTONE_LABELS: Record<CapstoneStatus, string> = { PROPOSED: 'Proposed', APPROVED: 'Approved', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', DECLINED: 'Declined' }

// What an alum can pick when applying; staff set WIOA, Pell, the fund or a
// board contract after checking eligibility.
export const APPLY_PAYERS = [
  { key: 'SELF_PAY', label: 'I’ll pay' },
  { key: 'EMPLOYER', label: 'My employer will pay' },
  { key: 'HELP', label: 'I need help paying' },
] as const

export function wioaOn(enabledFeatures: unknown): boolean {
  return (enabledFeatures as { wioa?: boolean } | null)?.wioa === true
}

// ── Programs and cohorts ─────────────────────────────────────────────────────

export async function listPrograms(institutionId: string) {
  return prisma.program.findMany({
    where: { institutionId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      cohorts: {
        orderBy: { startsAt: 'asc' },
        include: {
          faculty: { select: { fullName: true, invitedEmail: true } },
          _count: { select: { enrollments: { where: { status: { in: ['ENROLLED', 'COMPLETED'] } } } } },
        },
      },
    },
  })
}

export async function saveProgram(args: {
  institutionId: string
  id?: string | null
  name: string
  summary: string | null
  audience: string | null
  credential: string | null
  priceCents: number
  wioaEligible: boolean
  isActive: boolean
  createdBy: string
}) {
  const data = { name: args.name, summary: args.summary, audience: args.audience, credential: args.credential, priceCents: args.priceCents, wioaEligible: args.wioaEligible, isActive: args.isActive }
  if (args.id) {
    const r = await prisma.program.updateMany({ where: { id: args.id, institutionId: args.institutionId }, data })
    return r.count ? { id: args.id } : { error: 'That program is gone. Reload the page.' }
  }
  const p = await prisma.program.create({ data: { ...data, institutionId: args.institutionId, createdBy: args.createdBy }, select: { id: true } })
  return { id: p.id }
}

export async function addCohort(args: { institutionId: string; programId: string; name: string; startsAt: Date; endsAt: Date | null; seats: number | null; modality: string | null; facultyUserId: string | null }) {
  const program = await prisma.program.findFirst({ where: { id: args.programId, institutionId: args.institutionId }, select: { id: true } })
  if (!program) return { error: 'That program is gone. Reload the page.' }
  if (args.facultyUserId) {
    const f = await prisma.institutionUser.findFirst({ where: { id: args.facultyUserId, institutionId: args.institutionId, role: { in: ['FACULTY', 'EXEC_ED'] }, revokedAt: null }, select: { id: true } })
    if (!f) return { error: 'Pick someone from your faculty.' }
  }
  const c = await prisma.cohort.create({
    data: { programId: args.programId, name: args.name, startsAt: args.startsAt, endsAt: args.endsAt, seats: args.seats, modality: args.modality, facultyUserId: args.facultyUserId },
    select: { id: true },
  })
  return { id: c.id }
}

// Cohorts an alum can apply to: active programs, not started more than two
// weeks ago, with seats left.
export async function openCohorts(institutionId: string, now = new Date()) {
  const cohorts = await prisma.cohort.findMany({
    where: { program: { institutionId, isActive: true }, startsAt: { gte: new Date(now.getTime() - 14 * DAY) } },
    orderBy: { startsAt: 'asc' },
    include: { program: { select: { name: true, summary: true, credential: true, priceCents: true, wioaEligible: true } }, _count: { select: { enrollments: { where: { status: { in: ['APPLIED', 'ENROLLED'] } } } } } },
  })
  return cohorts.map((c) => ({ ...c, seatsLeft: c.seats === null ? null : Math.max(c.seats - c._count.enrollments, 0) })).filter((c) => c.seatsLeft !== 0)
}

// ── Enrollment ───────────────────────────────────────────────────────────────

export async function applyToCohort(args: { institutionId: string; memberId: string; cohortId: string; payer: (typeof APPLY_PAYERS)[number]['key']; note: string }) {
  const cohort = (await openCohorts(args.institutionId)).find((c) => c.id === args.cohortId)
  if (!cohort) return { error: 'That cohort is full or no longer taking applications.' }
  const existing = await prisma.enrollment.findUnique({ where: { cohortId_memberId: { cohortId: args.cohortId, memberId: args.memberId } }, select: { status: true } })
  if (existing && existing.status !== 'WITHDREW') return { error: 'You’ve already applied to this cohort.' }
  const payer: ProgramPayer = args.payer === 'EMPLOYER' ? 'EMPLOYER' : 'SELF_PAY'
  const note = [args.payer === 'HELP' ? 'Needs help paying.' : null, args.note.trim().slice(0, 1000) || null].filter(Boolean).join(' ') || null
  const e = await prisma.enrollment.upsert({
    where: { cohortId_memberId: { cohortId: args.cohortId, memberId: args.memberId } },
    create: { cohortId: args.cohortId, memberId: args.memberId, payer, note },
    update: { status: 'APPLIED', payer, note, appliedAt: new Date(), withdrewAt: null },
    select: { id: true },
  })
  return { id: e.id }
}

export async function listEnrollments(institutionId: string, filter: { status?: EnrollmentStatus; payer?: ProgramPayer } = {}) {
  return prisma.enrollment.findMany({
    where: { cohort: { program: { institutionId } }, ...(filter.status ? { status: filter.status } : {}), ...(filter.payer ? { payer: filter.payer } : {}) },
    orderBy: [{ status: 'asc' }, { appliedAt: 'desc' }],
    take: 300,
    include: {
      member: { select: { id: true, firstName: true, lastName: true, classYear: true, email: true } },
      cohort: { select: { name: true, startsAt: true, program: { select: { name: true, credential: true } } } },
      corporateClient: { select: { name: true } },
    },
  })
}

// Staff moves an enrollment along. Completing records the program's
// credential and scores the program for engagement (if shared).
export async function updateEnrollment(args: { institutionId: string; enrollmentId: string; status?: EnrollmentStatus; payer?: ProgramPayer; corporateClientId?: string | null; now?: Date }) {
  const now = args.now ?? new Date()
  const e = await prisma.enrollment.findFirst({
    where: { id: args.enrollmentId, cohort: { program: { institutionId: args.institutionId } } },
    select: { id: true, memberId: true, status: true, enrolledAt: true, cohort: { select: { program: { select: { credential: true, name: true } } } } },
  })
  if (!e) return { error: 'That enrollment is gone. Reload the page.' }
  if (args.corporateClientId) {
    const c = await prisma.corporateClient.findFirst({ where: { id: args.corporateClientId, institutionId: args.institutionId }, select: { id: true } })
    if (!c) return { error: 'Pick one of your corporate clients.' }
  }
  const data: Parameters<typeof prisma.enrollment.update>[0]['data'] = {}
  if (args.payer) {
    data.payer = args.payer
    data.corporateClientId = args.payer === 'EMPLOYER' ? (args.corporateClientId ?? null) : null
  }
  if (args.status && args.status !== e.status) {
    data.status = args.status
    if (args.status === 'ENROLLED') data.enrolledAt = e.enrolledAt ?? now
    if (args.status === 'COMPLETED') {
      data.completedAt = now
      data.enrolledAt = e.enrolledAt ?? now
      data.credentialName = e.cohort.program.credential ?? e.cohort.program.name
    }
    if (args.status === 'WITHDREW') data.withdrewAt = now
  }
  await prisma.enrollment.update({ where: { id: e.id }, data })
  if (args.status === 'COMPLETED' && e.status !== 'COMPLETED') {
    const [consent] = await prisma.$queryRaw<{ shareEngagement: boolean }[]>`select "shareEngagement" from private.v_member_consent where "memberId" = ${e.memberId}`
    if (consent?.shareEngagement) {
      await prisma.engagementEvent.createMany({
        data: [{ institutionId: args.institutionId, memberId: e.memberId, type: 'EVENT', caseCategory: 'EXPERIENTIAL', points: 3, occurredAt: now, sourceTable: 'Enrollment', sourceId: e.id }],
        skipDuplicates: true,
      })
    }
  }
  return { ok: true }
}

export async function myEnrollments(memberId: string) {
  return prisma.enrollment.findMany({
    where: { memberId, status: { not: 'WITHDREW' } },
    orderBy: { appliedAt: 'desc' },
    select: { id: true, status: true, payer: true, credentialName: true, completedAt: true, cohort: { select: { name: true, startsAt: true, endsAt: true, modality: true, program: { select: { name: true } } } } },
  })
}

// ── Corporate clients ───────────────────────────────────────────────────────

export async function listClients(institutionId: string) {
  const clients = await prisma.corporateClient.findMany({
    where: { institutionId },
    orderBy: { name: 'asc' },
    include: { enrollments: { where: { status: { not: 'WITHDREW' } }, select: { status: true } } },
  })
  return clients.map(({ enrollments, ...c }) => ({
    ...c,
    seatsUsed: enrollments.length,
    completed: enrollments.filter((e) => e.status === 'COMPLETED').length,
  }))
}

export async function saveClient(args: { institutionId: string; id?: string | null; name: string; contactName: string | null; contactEmail: string | null; seatsPurchased: number; notes: string | null }) {
  const data = { name: args.name, contactName: args.contactName, contactEmail: args.contactEmail, seatsPurchased: args.seatsPurchased, notes: args.notes }
  if (args.id) {
    const r = await prisma.corporateClient.updateMany({ where: { id: args.id, institutionId: args.institutionId }, data })
    return r.count ? { id: args.id } : { error: 'That client is gone. Reload the page.' }
  }
  const c = await prisma.corporateClient.create({ data: { ...data, institutionId: args.institutionId }, select: { id: true } })
  return { id: c.id }
}

// ── Capstones ───────────────────────────────────────────────────────────────

export async function listCapstones(institutionId: string, institutionEmployerId?: string) {
  return prisma.capstone.findMany({
    where: { institutionId, ...(institutionEmployerId ? { institutionEmployerId } : {}) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { program: { select: { name: true } }, faculty: { select: { fullName: true, invitedEmail: true } } },
  })
}

export async function proposeCapstone(args: {
  institutionId: string
  institutionEmployerId: string | null
  employerName: string
  title: string
  brief: string
  term: string | null
  interviewCommitments: number
  proposedBy: string
}) {
  const c = await prisma.capstone.create({
    data: {
      institutionId: args.institutionId,
      institutionEmployerId: args.institutionEmployerId,
      employerName: args.employerName,
      title: args.title,
      brief: args.brief,
      term: args.term,
      interviewCommitments: Math.min(Math.max(Math.round(args.interviewCommitments) || 0, 0), 50),
      proposedBy: args.proposedBy,
    },
    select: { id: true },
  })
  return { id: c.id }
}

export async function updateCapstone(args: { institutionId: string; id: string; status: CapstoneStatus; facultyUserId?: string | null; programId?: string | null; courseName?: string | null }) {
  const c = await prisma.capstone.findFirst({ where: { id: args.id, institutionId: args.institutionId }, select: { id: true, status: true } })
  if (!c) return { error: 'That capstone is gone. Reload the page.' }
  await prisma.capstone.update({
    where: { id: c.id },
    data: {
      status: args.status,
      ...(c.status === 'PROPOSED' && args.status !== 'PROPOSED' ? { decidedAt: new Date() } : {}),
      ...(args.facultyUserId !== undefined ? { facultyUserId: args.facultyUserId } : {}),
      ...(args.programId !== undefined ? { programId: args.programId } : {}),
      ...(args.courseName !== undefined ? { courseName: args.courseName } : {}),
    },
  })
  return { ok: true }
}

// ── Workforce board (WIOA) ──────────────────────────────────────────────────

export type WioaRow = {
  enrollmentId: string
  firstName: string | null
  lastName: string | null
  email: string
  program: string
  cohort: string
  payer: ProgramPayer
  status: EnrollmentStatus
  enrolledAt: Date | null
  completedAt: Date | null
  credential: string | null
  placedAt: Date | null
  employer: string | null // only when the participant shares their outcome
}

// Board-funded participants (WIOA vouchers and board contracts) and what
// happened: completion, credential, and a new job within 180 days of exit.
export async function wioaReport(institutionId: string, now = new Date()) {
  const rows = await prisma.$queryRaw<WioaRow[]>`
    select e.id as "enrollmentId", m."firstName", m."lastName", m.email, p.name as program, c.name as cohort, e.payer, e.status,
           e."enrolledAt", e."completedAt", e."credentialName" as credential,
           (select min(o."reportedAt") from public."OutcomeReport" o
              where o."memberId" = m.id and e."completedAt" is not null and o."reportedAt" >= e."completedAt"
                and o."reportedAt" < e."completedAt" + make_interval(days => ${PLACEMENT_WINDOW_DAYS}::int)) as "placedAt",
           d.employer
    from public."Enrollment" e
    join public."Cohort" c on c.id = e."cohortId"
    join public."Program" p on p.id = c."programId"
    join public."InstitutionMember" m on m.id = e."memberId"
    left join private.v_member_directory d on d."memberId" = m.id
    where p."institutionId" = ${institutionId} and e.payer in ('WIOA_VOUCHER', 'BOARD_CONTRACT') and e.status <> 'APPLIED'
    order by e."enrolledAt" desc nulls last`
  const exited = rows.filter((r) => r.completedAt)
  const matured = exited.filter((r) => now.getTime() - new Date(r.completedAt!).getTime() >= PLACEMENT_WINDOW_DAYS * DAY || r.placedAt)
  return {
    rows,
    enrolled: rows.length,
    inTraining: rows.filter((r) => r.status === 'ENROLLED').length,
    completed: exited.length,
    credentials: exited.filter((r) => r.credential).length,
    placed: rows.filter((r) => r.placedAt).length,
    // Placement rate only over completers whose 180 days are up (or who already placed).
    placementRate: matured.length ? matured.filter((r) => r.placedAt).length / matured.length : null,
  }
}
