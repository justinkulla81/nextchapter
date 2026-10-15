// V2 programs (spec §13), lean: Exec Ed runs programs in cohorts, alumni
// apply, staff enroll and record who pays, completers earn the program's
// credential. Corporate clients buy seats; employers sponsor capstones that
// Teaching approves; the Workforce board sees WIOA-funded participants.
// "Placed" is never typed in: it's an OutcomeReport after completion.

import 'server-only'
import type { CapstoneStatus, EnrollmentStatus, ProgramPayer } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { LearnerRow } from './crm-csv'

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
  skills?: string[]
  cipCode?: string | null
  hours?: number | null
  credentialType?: string | null
  prerequisites?: string | null
}) {
  const data = {
    name: args.name,
    summary: args.summary,
    audience: args.audience,
    credential: args.credential,
    priceCents: args.priceCents,
    wioaEligible: args.wioaEligible,
    isActive: args.isActive,
    ...(args.skills ? { skills: args.skills } : {}),
    ...(args.cipCode !== undefined ? { cipCode: args.cipCode } : {}),
    ...(args.hours !== undefined ? { hours: args.hours } : {}),
    ...(args.credentialType !== undefined ? { credentialType: args.credentialType } : {}),
    ...(args.prerequisites !== undefined ? { prerequisites: args.prerequisites } : {}),
  }
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
    include: { program: { select: { name: true, summary: true, credential: true, priceCents: true, wioaEligible: true, skills: true } }, _count: { select: { enrollments: { where: { status: { in: ['APPLIED', 'ENROLLED'] } } } } } },
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
      cohort: { select: { name: true, startsAt: true, sessionsTotal: true, minAttendancePct: true, requiresCapstone: true, program: { select: { name: true, credential: true } } } },
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
    select: { id: true, memberId: true, status: true, enrolledAt: true, credentialId: true, sessionsAttended: true, capstoneDone: true, cohort: { select: { sessionsTotal: true, minAttendancePct: true, requiresCapstone: true, program: { select: { credential: true, name: true } } } } },
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
      const blocked = completionBlocker(e.cohort, e)
      if (blocked) return { error: blocked }
      data.completedAt = now
      // A public, verifiable credential id (Open Badges): /credentials/<id>.
      data.credentialId = e.credentialId ?? randomUUID()
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
    select: { id: true, status: true, payer: true, credentialName: true, credentialId: true, completedAt: true, cohort: { select: { name: true, startsAt: true, endsAt: true, modality: true, program: { select: { name: true } } } } },
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

// ── Completion rules and attendance ─────────────────────────────────────────

// Why an enrollment can't be marked completed yet, or null.
export function completionBlocker(
  cohort: { sessionsTotal: number | null; minAttendancePct: number | null; requiresCapstone: boolean },
  e: { sessionsAttended: number; capstoneDone: boolean },
): string | null {
  if (cohort.minAttendancePct && cohort.sessionsTotal) {
    const need = Math.ceil((cohort.minAttendancePct / 100) * cohort.sessionsTotal)
    if (e.sessionsAttended < need) return `Needs ${need} of ${cohort.sessionsTotal} sessions attended (${cohort.minAttendancePct}%); has ${e.sessionsAttended}.`
  }
  if (cohort.requiresCapstone && !e.capstoneDone) return 'Needs the capstone marked done first.'
  return null
}

export async function setProgress(args: { institutionId: string; enrollmentId: string; sessionsAttended?: number; capstoneDone?: boolean }) {
  const e = await prisma.enrollment.findFirst({ where: { id: args.enrollmentId, cohort: { program: { institutionId: args.institutionId } } }, select: { id: true, cohort: { select: { sessionsTotal: true } } } })
  if (!e) return { error: 'That enrollment is gone. Reload the page.' }
  const max = e.cohort.sessionsTotal ?? 200
  await prisma.enrollment.update({
    where: { id: e.id },
    data: {
      ...(args.sessionsAttended !== undefined ? { sessionsAttended: Math.min(Math.max(Math.round(args.sessionsAttended), 0), max) } : {}),
      ...(args.capstoneDone !== undefined ? { capstoneDone: args.capstoneDone } : {}),
    },
  })
  return { ok: true }
}

export async function setCohortRules(args: { institutionId: string; cohortId: string; sessionsTotal: number | null; minAttendancePct: number | null; requiresCapstone: boolean }) {
  const r = await prisma.cohort.updateMany({
    where: { id: args.cohortId, program: { institutionId: args.institutionId } },
    data: { sessionsTotal: args.sessionsTotal, minAttendancePct: args.minAttendancePct, requiresCapstone: args.requiresCapstone },
  })
  return r.count ? { ok: true } : { error: 'That cohort is gone. Reload the page.' }
}

// ── Non-alum learners ───────────────────────────────────────────────────────

// A corporate client's employee or a community member: a roster row with
// affiliation LEARNER (never sent alumni email or invitations), enrolled
// straight into a cohort. An existing roster email is reused.
export async function addLearner(args: { institutionId: string; cohortId: string; firstName: string; lastName: string; email: string; corporateClientId: string | null; payer: ProgramPayer }) {
  const cohort = await prisma.cohort.findFirst({ where: { id: args.cohortId, program: { institutionId: args.institutionId } }, select: { id: true } })
  if (!cohort) return { error: 'Pick a cohort.' }
  const email = args.email.trim().toLowerCase()
  const member =
    (await prisma.institutionMember.findFirst({ where: { institutionId: args.institutionId, email }, select: { id: true } })) ??
    (await prisma.institutionMember.create({
      data: { institutionId: args.institutionId, email, firstName: args.firstName || null, lastName: args.lastName || null, affiliation: 'LEARNER', matchMethod: 'MANUAL' },
      select: { id: true },
    }))
  const existing = await prisma.enrollment.findUnique({ where: { cohortId_memberId: { cohortId: args.cohortId, memberId: member.id } }, select: { id: true } })
  if (existing) return { error: 'They’re already in that cohort.' }
  const e = await prisma.enrollment.create({
    data: { cohortId: args.cohortId, memberId: member.id, status: 'ENROLLED', enrolledAt: new Date(), payer: args.payer, corporateClientId: args.payer === 'EMPLOYER' ? args.corporateClientId : null },
    select: { id: true },
  })
  return { id: e.id, memberId: member.id }
}

// A spreadsheet of learners into one cohort. Payer per row (else the form's),
// employer matched to a corporate client by name. People already in the
// cohort are left as they are.
export async function importLearners(args: { institutionId: string; cohortId: string; rows: LearnerRow[]; defaultPayer: ProgramPayer; defaultClientId: string | null }) {
  const clients = await prisma.corporateClient.findMany({ where: { institutionId: args.institutionId }, select: { id: true, name: true } })
  const PAYERS: ProgramPayer[] = ['SELF_PAY', 'EMPLOYER', 'RESILIENCE_FUND', 'WIOA_VOUCHER', 'BOARD_CONTRACT', 'PELL']
  let enrolled = 0
  let already = 0
  const errors: { row: number; message: string }[] = []
  for (const r of args.rows) {
    const payer = r.payer ? (PAYERS.find((p) => p === r.payer || p.replace('_VOUCHER', '') === r.payer) ?? null) : args.defaultPayer
    if (!payer) {
      errors.push({ row: r.row, message: `Payer must be one of ${PAYERS.join(', ')}.` })
      continue
    }
    const client = r.employer ? clients.find((c) => c.name.toLowerCase() === r.employer!.toLowerCase()) : null
    if (r.employer && !client) {
      errors.push({ row: r.row, message: `No corporate client called “${r.employer}”. Add it first, or leave employer blank.` })
      continue
    }
    const res = await addLearner({ institutionId: args.institutionId, cohortId: args.cohortId, firstName: r.firstName, lastName: r.lastName, email: r.email, payer, corporateClientId: client?.id ?? args.defaultClientId })
    if ('error' in res) {
      if (res.error?.startsWith('They’re already')) already++
      else errors.push({ row: r.row, message: res.error ?? 'Couldn’t enroll.' })
    } else enrolled++
  }
  return { enrolled, already, errors }
}

// ── Credentials (Open Badges 2.0, hosted verification) ──────────────────────

export async function credentialById(credentialId: string) {
  return prisma.enrollment.findUnique({
    where: { credentialId },
    select: {
      credentialId: true,
      credentialName: true,
      completedAt: true,
      status: true,
      member: { select: { firstName: true, lastName: true, email: true } },
      cohort: { select: { name: true, program: { select: { id: true, name: true, summary: true, skills: true, institution: { select: { slug: true, name: true, logoUrl: true, profile: true } } } } } },
    },
  })
}

// ── State eligible training provider list (ETPL) ────────────────────────────

export type EtplRow = {
  programId: string
  name: string
  cipCode: string | null
  credentialType: string | null
  credential: string | null
  hours: number | null
  costCents: number
  modality: string | null
  prerequisites: string | null
  wioaEligible: boolean
  enrolled: number
  completed: number
  completionRate: number | null
  credentialRate: number | null
  placementRate: number | null // a new job within 180 days of completion, among completers whose window has closed
}

// The fields and outcomes most state ETPL applications ask for, per program,
// over every enrollment (not only WIOA-funded). Missing fields are listed
// on the screen so staff know what to fill in.
export async function etplRows(institutionId: string, now = new Date()): Promise<EtplRow[]> {
  const programs = await prisma.program.findMany({
    where: { institutionId },
    orderBy: { name: 'asc' },
    include: {
      cohorts: {
        select: {
          modality: true,
          enrollments: { where: { status: { in: ['ENROLLED', 'COMPLETED', 'WITHDREW'] } }, select: { status: true, completedAt: true, credentialName: true, memberId: true } },
        },
      },
    },
  })
  const out: EtplRow[] = []
  for (const p of programs) {
    const ens = p.cohorts.flatMap((c) => c.enrollments)
    const done = ens.filter((e) => e.status === 'COMPLETED' && e.completedAt)
    const matured = done.filter((e) => now.getTime() - e.completedAt!.getTime() >= PLACEMENT_WINDOW_DAYS * DAY)
    let placed = 0
    for (const e of matured) {
      const o = await prisma.outcomeReport.findFirst({ where: { memberId: e.memberId, reportedAt: { gte: e.completedAt!, lt: new Date(e.completedAt!.getTime() + PLACEMENT_WINDOW_DAYS * DAY) } }, select: { id: true } })
      if (o) placed++
    }
    const modalities = [...new Set(p.cohorts.map((c) => c.modality).filter(Boolean))]
    out.push({
      programId: p.id,
      name: p.name,
      cipCode: p.cipCode,
      credentialType: p.credentialType,
      credential: p.credential,
      hours: p.hours,
      costCents: p.priceCents,
      modality: modalities.join(', ') || null,
      prerequisites: p.prerequisites,
      wioaEligible: p.wioaEligible,
      enrolled: ens.length,
      completed: done.length,
      completionRate: ens.length ? done.length / ens.length : null,
      credentialRate: done.length ? done.filter((e) => e.credentialName).length / done.length : null,
      placementRate: matured.length ? placed / matured.length : null,
    })
  }
  return out
}

export function etplMissing(r: EtplRow): string[] {
  return [!r.cipCode && 'CIP code', !r.hours && 'hours', !r.credentialType && 'credential type', !r.prerequisites && 'prerequisites (or "none")'].filter(Boolean) as string[]
}
