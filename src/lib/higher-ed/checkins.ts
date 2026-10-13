// College check-ins (spec §6.6, HE-11): early-career check-ins 6, 18 and 24
// months after graduation, and one annual check-in for every alum in the
// month the college picked. Both are services in Admin › Services; turning
// one off stops scheduling it.
//
// The nightly job schedules what's due (idempotent on member, kind, due
// date). Nothing is emailed until staff approve the batch from "Waiting for
// you", so a college never sends more than it meant to. Each email asks
// "Has anything changed?" with four one-click answers; the answer page
// confirms before recording, so link scanners can't answer for anyone.

import 'server-only'
import type { CheckInKind, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { applyJourneyChange } from '@/lib/journey/apply'
import { captureServerEvent } from '@/lib/posthog/server'
import { checkInMonthFrom, serviceSettingsFrom } from './services'
import { graceDaysFrom, openTransitionFlag, placeOpenFlag } from './transition'
import { sendCampaign } from './outreach'
import { autoAssign } from './caseload'

const DAY = 86_400_000

// Graduation is assumed mid-May of the class year unless the college knows better.
export function graduationDate(classYear: number): Date {
  return new Date(Date.UTC(classYear, 4, 15))
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d)
  x.setUTCMonth(x.getUTCMonth() + months)
  return x
}

export const EARLY_CAREER: { kind: Exclude<CheckInKind, 'CUSTOM'>; months: number }[] = [
  { kind: 'M6', months: 6 },
  { kind: 'M18', months: 18 },
  { kind: 'M24', months: 24 },
]

// A check-in is scheduled once it's due, and only while it's still fresh:
// a roster imported years after graduation doesn't backfill old check-ins.
const FRESH_DAYS = 45

// Which early-career check-in (if any) is due for a class year right now.
export function earlyCareerDue(classYear: number, now: Date): { kind: CheckInKind; dueAt: Date } | null {
  const grad = graduationDate(classYear)
  for (const c of EARLY_CAREER) {
    const dueAt = addMonths(grad, c.months)
    const age = now.getTime() - dueAt.getTime()
    if (age >= 0 && age < FRESH_DAYS * DAY) return { kind: c.kind, dueAt }
  }
  return null
}

// The annual check-in's date this year, while its month is running.
export function annualDue(month: number, now: Date): Date | null {
  const dueAt = new Date(Date.UTC(now.getUTCFullYear(), month - 1, 1))
  const age = now.getTime() - dueAt.getTime()
  return age >= 0 && age < FRESH_DAYS * DAY ? dueAt : null
}

export async function scheduleCheckIns(institutionId: string, now = new Date()): Promise<{ scheduled: number }> {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  const services = serviceSettingsFrom(inst.enabledFeatures)
  const rows: Prisma.CheckInCreateManyInput[] = []
  const base = { institutionId, status: { not: 'OPTED_OUT' as const }, doNotContact: false }

  if (services.grad_checkins?.on) {
    const years = [...new Set(EARLY_CAREER.map((c) => now.getUTCFullYear() - Math.ceil(c.months / 12)).flatMap((y) => [y - 1, y, y + 1]))]
    const grads = await prisma.institutionMember.findMany({
      where: { ...base, affiliation: { in: ['ALUM', 'STAFF_ALUM'] }, classYear: { in: years } },
      select: { id: true, classYear: true },
    })
    for (const g of grads) {
      const due = earlyCareerDue(g.classYear!, now)
      if (due) rows.push({ memberId: g.id, kind: due.kind, dueAt: due.dueAt })
    }
  }

  // Early-career rows go in first, so the annual pass below sees them and
  // doesn't send a recent grad two check-ins in one month.
  let scheduled = rows.length ? (await prisma.checkIn.createMany({ data: rows.splice(0), skipDuplicates: true })).count : 0

  const annual = services.annual_checkin?.on ? annualDue(checkInMonthFrom(inst.enabledFeatures), now) : null
  if (annual) {
    // Recent grads already hear from Career Services; skip anyone with a
    // check-in in the last four months.
    const recent = new Date(now.getTime() - 120 * DAY)
    const alumni = await prisma.institutionMember.findMany({
      where: { ...base, affiliation: { in: ['ALUM', 'STAFF_ALUM'] }, checkIns: { none: { dueAt: { gte: recent } } } },
      select: { id: true },
    })
    for (const a of alumni) rows.push({ memberId: a.id, kind: 'CUSTOM', dueAt: annual })
  }

  if (rows.length) scheduled += (await prisma.checkIn.createMany({ data: rows, skipDuplicates: true })).count
  return { scheduled }
}

// What's waiting for staff approval, per kind.
export async function pendingCheckIns(institutionId: string, now = new Date()) {
  const rows = await prisma.checkIn.groupBy({
    by: ['kind'],
    where: { status: 'SCHEDULED', dueAt: { lte: now }, member: { institutionId } },
    _count: { _all: true },
  })
  return rows.map((r) => ({ kind: r.kind, count: r._count._all }))
}

export const CHECKIN_ANSWERS = [
  { key: 'good', label: 'All good' },
  { key: 'looking', label: "I'm starting to look" },
  { key: 'laid_off', label: 'I was laid off' },
  { key: 'new_job', label: 'New job or promotion' },
] as const
export type CollegeCheckInAnswer = (typeof CHECKIN_ANSWERS)[number]['key']

export function isCheckInAnswer(a: unknown): a is CollegeCheckInAnswer {
  return CHECKIN_ANSWERS.some((x) => x.key === a)
}

export const CHECKIN_SUBJECT = 'Has anything changed, {{firstName}}?'
export const CHECKIN_BODY = `Hi {{firstName}},

{{college}} checks in with alumni once a year (and a few times in your first two years out). One click:

All good: {{link}}&a=good
I'm starting to look: {{link}}&a=looking
I was laid off: {{link}}&a=laid_off
New job or promotion: {{link}}&a=new_job

If you're looking, {{college}} has free help ready: a clear read on your job market, a plan, coaching and alumni who'll take your call.

{{college}} Career Services`

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Staff approved the batch: one CHECK_IN campaign per kind for everything due.
export async function sendDueCheckIns(args: { institutionId: string; createdBy: string; kinds?: CheckInKind[]; now?: Date }) {
  const now = args.now ?? new Date()
  const due = await prisma.checkIn.findMany({
    where: { status: 'SCHEDULED', dueAt: { lte: now }, member: { institutionId: args.institutionId }, ...(args.kinds ? { kind: { in: args.kinds } } : {}) },
    select: { id: true, memberId: true, kind: true },
  })
  if (!due.length) return { sent: 0, skipped: 0, demo: false }
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: args.institutionId }, select: { slug: true } })
  let sent = 0
  let skipped = 0
  let demo = false
  for (const kind of [...new Set(due.map((d) => d.kind))]) {
    const batch = due.filter((d) => d.kind === kind)
    const byMember = new Map(batch.map((d) => [d.memberId, d.id]))
    const result = await sendCampaign({
      institutionId: args.institutionId,
      type: 'CHECK_IN',
      subject: CHECKIN_SUBJECT,
      body: CHECKIN_BODY,
      createdBy: args.createdBy,
      recipients: batch.map((d) => ({ memberId: d.memberId })),
      linkFor: (m, token) => `${appUrl()}/i/${inst.slug}/checkin/${byMember.get(m.id)}?t=${encodeURIComponent(token)}`,
    })
    const sentIds = batch.filter((d) => result.sendIds.has(d.memberId)).map((d) => d.id)
    const skippedIds = batch.filter((d) => !result.sendIds.has(d.memberId)).map((d) => d.id)
    if (sentIds.length) await prisma.checkIn.updateMany({ where: { id: { in: sentIds } }, data: { status: 'SENT', sentAt: now } })
    if (skippedIds.length) await prisma.checkIn.updateMany({ where: { id: { in: skippedIds } }, data: { status: 'SKIPPED' } })
    sent += result.sent
    skipped += result.skipped
    demo = result.demo
  }
  return { sent, skipped, demo }
}

// The answer page: the check-in, checked against the email's token.
export async function findCheckInForAnswer(slug: string, checkInId: string, token: string) {
  const c = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: {
      id: true,
      kind: true,
      status: true,
      responseJson: true,
      member: { select: { id: true, firstName: true, candidateId: true, status: true, institution: { select: { id: true, slug: true, name: true } } } },
    },
  })
  if (!c || c.member.institution.slug !== slug) return null
  const send = await prisma.outreachSend.findUnique({ where: { claimToken: token }, select: { id: true, memberId: true, clickedAt: true } })
  if (!send || send.memberId !== c.member.id) return null
  if (!send.clickedAt) await prisma.outreachSend.update({ where: { id: send.id }, data: { clickedAt: new Date() } })
  return c
}

// Record an answer. Idempotent: answering again replaces the answer but
// doesn't repeat what the first answer already did.
export async function answerCheckIn(args: { checkInId: string; memberId: string; answer: CollegeCheckInAnswer; now?: Date }) {
  const now = args.now ?? new Date()
  const c = await prisma.checkIn.findUniqueOrThrow({
    where: { id: args.checkInId },
    select: {
      kind: true,
      status: true,
      responseJson: true,
      member: { select: { id: true, candidateId: true, status: true, institutionId: true, institution: { select: { enabledFeatures: true } } } },
    },
  })
  if (c.member.id !== args.memberId) throw new Error('Not your check-in')
  const previous = (c.responseJson as { answer?: string } | null)?.answer
  await prisma.checkIn.update({
    where: { id: args.checkInId },
    data: { status: 'RESPONDED', respondedAt: now, responseJson: { answer: args.answer, previous: previous ?? null } },
  })
  if (previous === args.answer) return { changed: false }

  const joined = !!c.member.candidateId && (c.member.status === 'CLAIMED' || c.member.status === 'ACTIVE')
  const earlyCareer = c.kind !== 'CUSTOM'
  // Laid off, or a recent grad starting to look: the college treats them as
  // in transition (do-not-solicit, counselor follow-up).
  if (args.answer === 'laid_off' || (args.answer === 'looking' && earlyCareer)) await openTransitionFlag(c.member.id, 'CHECK_IN')
  // Anyone asking for help lands on a counselor's caseload.
  const counselorId = args.answer === 'laid_off' || args.answer === 'looking' ? await autoAssign(c.member.institutionId, c.member.id) : null
  if (args.answer === 'new_job') await placeOpenFlag(c.member.id, graceDaysFrom(c.member.institution.enabledFeatures), now)
  if (joined) {
    const change =
      args.answer === 'laid_off'
        ? { journey: 'LAID_OFF' as const, stage: 'APPLYING' as const }
        : args.answer === 'looking'
          ? { stage: 'APPLYING' as const }
          : args.answer === 'new_job'
            ? { stage: 'LANDED' as const }
            : {}
    await applyJourneyChange(c.member.candidateId!, { ...change, source: 'CHECK_IN', isCheckIn: true, note: `College check-in (${c.kind})` }, now)
  }
  captureServerEvent(c.member.candidateId ?? `member:${c.member.id}`, 'he_checkin_answered', {
    institutionId: c.member.institutionId,
    checkInId: args.checkInId,
    kind: c.kind,
    answer: args.answer,
    joined,
    autoAssigned: !!counselorId,
  })
  return { changed: true }
}

// Career Services › Check-ins: response rate per kind, and the people who
// asked for help (counselor follow-ups), newest first.
export async function checkInOverview(institutionId: string, now = new Date()) {
  const since = new Date(now.getTime() - 400 * DAY)
  const rows = await prisma.checkIn.findMany({
    where: { member: { institutionId }, dueAt: { gte: since } },
    select: {
      id: true,
      kind: true,
      status: true,
      dueAt: true,
      respondedAt: true,
      responseJson: true,
      member: { select: { id: true, firstName: true, lastName: true, classYear: true, email: true } },
    },
    orderBy: { dueAt: 'desc' },
  })
  const kinds: CheckInKind[] = ['M6', 'M18', 'M24', 'CUSTOM']
  const byKind = kinds.map((k) => {
    const r = rows.filter((x) => x.kind === k)
    const sent = r.filter((x) => x.status === 'SENT' || x.status === 'RESPONDED').length
    const responded = r.filter((x) => x.status === 'RESPONDED').length
    return { kind: k, scheduled: r.filter((x) => x.status === 'SCHEDULED').length, sent, responded }
  })
  const followUps = rows
    .filter((x) => x.status === 'RESPONDED' && ['looking', 'laid_off'].includes((x.responseJson as { answer?: string } | null)?.answer ?? ''))
    .sort((a, b) => (b.respondedAt?.getTime() ?? 0) - (a.respondedAt?.getTime() ?? 0))
    .map((x) => ({ id: x.id, kind: x.kind, respondedAt: x.respondedAt!, answer: (x.responseJson as { answer: CollegeCheckInAnswer }).answer, member: x.member }))
  return { byKind, followUps }
}

export const CHECKIN_KIND_LABELS: Record<CheckInKind, string> = {
  M6: '6 months out',
  M18: '18 months out',
  M24: '24 months out',
  CUSTOM: 'Annual',
}
