'use server'

// The college at every stage: intros, office hours, events (members); events
// and segments (Alumni Relations); attendance, rules and learners (Exec Ed);
// rapid response (Workforce board).

import { revalidatePath } from 'next/cache'
import type { ProgramPayer } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace, type WorkspaceContext } from '@/lib/higher-ed/access'
import type { AccessToken, WorkspaceKey } from '@/lib/higher-ed/workspaces'
import { prisma } from '@/lib/prisma'
import { addOfficeHours, answerAlumniIntro, bookOfficeHour, cancelOfficeHour, checkIn, EVENT_KINDS, INTRO_PURPOSES, requestAlumniIntro, rsvp, type IntroPurpose } from '@/lib/higher-ed/lifecycle'
import { collegeTimeZone, zonedToUtc } from '@/lib/higher-ed/time-zone'
import { deleteSegment, parseFilters, saveSegment } from '@/lib/higher-ed/segments'
import { addLearner, importLearners, setCohortRules, setProgress } from '@/lib/higher-ed/programs'
import { parseLearners } from '@/lib/higher-ed/crm-csv'
import { createRapidResponse, setRapidResponseActive } from '@/lib/higher-ed/rapid-response'

type Result = { error?: string; ok?: boolean; message?: string }
export type FormResult = Result | undefined

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const PREVIEW = 'You’re previewing; there’s no member record to act as.'

async function zoneFor(institutionId: string) {
  const i = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true, profile: true } })
  return collegeTimeZone(i.enabledFeatures, i.profile)
}

async function member(slug: string) {
  const ctx = await requireWorkspace(slug, 'candidate', { write: true })
  return ctx.memberId ? { ctx, memberId: ctx.memberId } : null
}
async function staff(slug: string, ws: WorkspaceKey, roles: AccessToken[]): Promise<WorkspaceContext | null> {
  const ctx = await requireWorkspace(slug, ws, { write: true })
  return roles.some((r) => ctx.tokens.has(r)) ? ctx : null
}

// ── Members ────────────────────────────────────────────────────────────────

export async function askForAlumniIntro(slug: string, targetMemberId: string, companyName: string, purpose: string, note: string, referralJobUrl: string | null = null): Promise<Result> {
  const m = await member(slug)
  if (!m) return { error: PREVIEW }
  if (!INTRO_PURPOSES.some((p) => p.key === purpose)) return { error: 'Pick why you’re asking.' }
  const r = await requestAlumniIntro({ institutionId: m.ctx.institution.id, requesterMemberId: m.memberId, targetMemberId, companyName, purpose: purpose as IntroPurpose, note: note.trim(), createdBy: m.ctx.userId, referralJobUrl })
  if ('error' in r) return { error: r.error }
  captureServerEvent(m.ctx.userId, 'he_alumni_intro_requested', { institutionId: m.ctx.institution.id, requestId: r.id, purpose })
  revalidatePath(`/i/${slug}/candidate/network`)
  return { ok: true, message: 'Sent. If they say yes, you’ll both get each other’s email.' }
}

export async function answerAlumniIntroAction(slug: string, requestId: string, accept: boolean): Promise<Result> {
  const m = await member(slug)
  if (!m) return { error: PREVIEW }
  const ok = await answerAlumniIntro(m.memberId, requestId, accept)
  captureServerEvent(m.ctx.userId, 'he_alumni_intro_answered', { institutionId: m.ctx.institution.id, requestId, accept })
  revalidatePath(`/i/${slug}/candidate/network`)
  return ok ? { ok: true, message: accept ? 'Accepted. Their email is below.' : 'Declined.' } : { error: 'Already answered.' }
}

export async function addOfficeHoursForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const m = await member(slug)
  if (!m) return { error: PREVIEW }
  const date = str(f, 'date')
  const time = str(f, 'time')
  if (!date || !time) return { error: 'Pick a day and a start time.' }
  const startsAt = zonedToUtc(date, time, await zoneFor(m.ctx.institution.id))
  if (!startsAt) return { error: 'That date or time doesn’t look right.' }
  const r = await addOfficeHours({ memberId: m.memberId, startsAt, count: Number(str(f, 'count') || '1'), minutes: Number(str(f, 'minutes') || '20'), topic: str(f, 'topic') || null })
  if ('error' in r) return { error: r.error }
  captureServerEvent(m.ctx.userId, 'he_office_hours_added', { institutionId: m.ctx.institution.id, slots: r.added })
  revalidatePath(`/i/${slug}/candidate/network`)
  return { ok: true, message: `${r.added} ${r.added === 1 ? 'slot' : 'slots'} added. Alumni can book them now.` }
}

export async function bookOfficeHourAction(slug: string, slotId: string, note: string): Promise<Result> {
  const m = await member(slug)
  if (!m) return { error: PREVIEW }
  const r = await bookOfficeHour({ slotId, memberId: m.memberId, note })
  if ('error' in r) return { error: r.error }
  captureServerEvent(m.ctx.userId, 'he_office_hour_booked', { institutionId: m.ctx.institution.id, slotId })
  revalidatePath(`/i/${slug}/candidate/network`)
  return { ok: true, message: 'Booked. Their email is under “Your calls”; send a calendar invite.' }
}

export async function cancelOfficeHourAction(slug: string, slotId: string): Promise<Result> {
  const m = await member(slug)
  if (!m) return { error: PREVIEW }
  const ok = await cancelOfficeHour(slotId, m.memberId)
  captureServerEvent(m.ctx.userId, 'he_office_hour_cancelled', { institutionId: m.ctx.institution.id, slotId })
  revalidatePath(`/i/${slug}/candidate/network`)
  return ok ? { ok: true } : { error: 'That isn’t yours to cancel.' }
}

export async function rsvpAction(slug: string, eventId: string, going: boolean): Promise<Result> {
  const m = await member(slug)
  if (!m) return { error: PREVIEW }
  const r = await rsvp(eventId, m.memberId, going)
  if ('error' in r) return { error: r.error }
  captureServerEvent(m.ctx.userId, 'he_event_rsvp', { institutionId: m.ctx.institution.id, eventId, going })
  revalidatePath(`/i/${slug}/candidate/network`)
  return { ok: true }
}

// ── Alumni Relations: events and segments ──────────────────────────────────

const ALUMNI: AccessToken[] = ['ALUMNI_RELATIONS', 'CAREER_SERVICES', 'INSTITUTION_ADMIN']

export async function createEventForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations, Career Services or an admin can add events.' }
  const title = str(f, 'title')
  const kind = str(f, 'kind')
  const startsAt = str(f, 'date') && str(f, 'time') ? zonedToUtc(str(f, 'date'), str(f, 'time'), await zoneFor(ctx.institution.id)) : null
  const capacity = str(f, 'capacity') ? Number(str(f, 'capacity')) : null
  const url = str(f, 'url')
  if (!title) return { error: 'Give the event a title.' }
  if (!EVENT_KINDS.some((k) => k.key === kind)) return { error: 'Pick what kind of event it is.' }
  if (!startsAt || Number.isNaN(startsAt.getTime())) return { error: 'Pick a date and start time.' }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return { error: 'Capacity is a whole number, or leave it blank.' }
  if (url && !/^https?:\/\/\S+$/.test(url)) return { error: 'The link must start with https://.' }
  const e = await prisma.collegeEvent.create({
    data: { institutionId: ctx.institution.id, title, kind, description: str(f, 'description') || null, startsAt, location: str(f, 'location') || null, url: url || null, capacity, createdBy: ctx.email ?? ctx.userId },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'he_event_created', { institutionId: ctx.institution.id, eventId: e.id, kind, capacity })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Added. Alumni see it on their Network tab.' }
}

export async function cancelEvent(slug: string, eventId: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations, Career Services or an admin can cancel events.' }
  await prisma.collegeEvent.updateMany({ where: { id: eventId, institutionId: ctx.institution.id }, data: { cancelledAt: new Date() } })
  captureServerEvent(ctx.userId, 'he_event_cancelled', { institutionId: ctx.institution.id, eventId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Cancelled.' }
}

export async function checkInAction(slug: string, rsvpId: string, on: boolean): Promise<Result> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only staff can check people in.' }
  const ok = await checkIn(ctx.institution.id, rsvpId, on)
  captureServerEvent(ctx.userId, 'he_event_checkin', { institutionId: ctx.institution.id, rsvpId, on })
  return ok ? { ok: true } : { error: 'That RSVP is gone.' }
}

export async function saveSegmentForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'alumni', ['ALUMNI_RELATIONS', 'INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only Alumni Relations or an admin can save segments.' }
  const name = str(f, 'name')
  if (!name) return { error: 'Name the segment.' }
  const num = (k: string) => (str(f, k) && Number.isInteger(Number(str(f, k))) ? Number(str(f, k)) : null)
  const filters = parseFilters({
    classFrom: num('classFrom'),
    classTo: num('classTo'),
    joined: str(f, 'joined') || null,
    majors: f.getAll('majors').map(String).filter(Boolean),
    employerContains: str(f, 'employerContains'),
    inTransition: f.get('inTransition') === 'on',
    metro: str(f, 'metro'),
  })
  const id = await saveSegment(ctx.institution.id, name, filters, ctx.email ?? ctx.userId)
  captureServerEvent(ctx.userId, 'he_segment_saved', { institutionId: ctx.institution.id, segmentId: id })
  revalidatePath(`/i/${slug}/alumni/outreach`)
  return { ok: true, message: 'Saved. Pick it under “Who it goes to”.' }
}

export async function deleteSegmentAction(slug: string, id: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', ['ALUMNI_RELATIONS', 'INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only Alumni Relations or an admin can delete segments.' }
  await deleteSegment(ctx.institution.id, id)
  captureServerEvent(ctx.userId, 'he_segment_deleted', { institutionId: ctx.institution.id, segmentId: id })
  revalidatePath(`/i/${slug}/alumni/outreach`)
  return { message: 'Deleted.' }
}

// ── Exec Ed: attendance, completion rules, learners ────────────────────────

const EXEC: AccessToken[] = ['EXEC_ED', 'FACULTY', 'INSTITUTION_ADMIN']

export async function setProgressAction(slug: string, enrollmentId: string, change: { sessionsAttended?: number; capstoneDone?: boolean }): Promise<Result> {
  const ctx = await staff(slug, 'execed', EXEC)
  if (!ctx) return { error: 'Only Exec Ed staff, faculty or an admin can record attendance.' }
  const r = await setProgress({ institutionId: ctx.institution.id, enrollmentId, ...change })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_enrollment_progress', { institutionId: ctx.institution.id, enrollmentId, ...change })
  revalidatePath(`/i/${slug}/execed/enrollments`)
  return { ok: true }
}

export async function setCohortRulesForm(slug: string, cohortId: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'execed', ['EXEC_ED', 'INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only Exec Ed staff or an admin can set completion rules.' }
  const sessions = str(f, 'sessionsTotal') ? Number(str(f, 'sessionsTotal')) : null
  const pct = str(f, 'minAttendancePct') ? Number(str(f, 'minAttendancePct')) : null
  if (sessions !== null && (!Number.isInteger(sessions) || sessions < 1 || sessions > 200)) return { error: 'Sessions is a whole number from 1 to 200.' }
  if (pct !== null && (!Number.isInteger(pct) || pct < 1 || pct > 100)) return { error: 'Attendance is a percent from 1 to 100.' }
  if (pct && !sessions) return { error: 'Set how many sessions there are to use an attendance rule.' }
  const r = await setCohortRules({ institutionId: ctx.institution.id, cohortId, sessionsTotal: sessions, minAttendancePct: pct, requiresCapstone: f.get('requiresCapstone') === 'on' })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_cohort_rules_set', { institutionId: ctx.institution.id, cohortId, sessions, pct })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Saved.' }
}

export async function addLearnerForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'execed', ['EXEC_ED', 'INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only Exec Ed staff or an admin can add learners.' }
  const email = str(f, 'email').toLowerCase()
  if (!str(f, 'firstName')) return { error: 'Add their first name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Add a valid email.' }
  const payer = (['SELF_PAY', 'EMPLOYER', 'WIOA_VOUCHER', 'BOARD_CONTRACT'].includes(str(f, 'payer')) ? str(f, 'payer') : 'SELF_PAY') as ProgramPayer
  const r = await addLearner({ institutionId: ctx.institution.id, cohortId: str(f, 'cohortId'), firstName: str(f, 'firstName'), lastName: str(f, 'lastName'), email, corporateClientId: str(f, 'clientId') || null, payer })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_learner_added', { institutionId: ctx.institution.id, enrollmentId: r.id, payer })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Enrolled.' }
}

export async function uploadLearnersForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'execed', ['EXEC_ED', 'INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only Exec Ed staff or an admin can add learners.' }
  const file = f.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'That file is over 5 MB. Split it up.' }
  const parsed = parseLearners(await file.text())
  if (parsed.fileError) return { error: parsed.fileError }
  const payer = (['SELF_PAY', 'EMPLOYER', 'WIOA_VOUCHER', 'BOARD_CONTRACT'].includes(str(f, 'payer')) ? str(f, 'payer') : 'SELF_PAY') as ProgramPayer
  const r = await importLearners({ institutionId: ctx.institution.id, cohortId: str(f, 'cohortId'), rows: parsed.rows, defaultPayer: payer, defaultClientId: payer === 'EMPLOYER' ? str(f, 'clientId') || null : null })
  const errors = [...parsed.errors, ...r.errors]
  captureServerEvent(ctx.userId, 'he_learners_uploaded', { institutionId: ctx.institution.id, cohortId: str(f, 'cohortId'), enrolled: r.enrolled, already: r.already, errors: errors.length })
  revalidatePath(`/i/${slug}`, 'layout')
  const summary = `${r.enrolled} enrolled${r.already ? `, ${r.already} already in the cohort` : ''}${errors.length ? `, ${errors.length} skipped` : ''}.`
  const detail = errors.slice(0, 8).map((e) => `Row ${e.row}: ${e.message}`).join(' ')
  return errors.length && !r.enrolled ? { error: `${summary} ${detail}` } : { ok: true, message: errors.length ? `${summary} ${detail}` : summary }
}

// ── Workforce board: rapid response ────────────────────────────────────────

const WORKFORCE: AccessToken[] = ['WORKFORCE_PARTNER', 'EXEC_ED', 'INSTITUTION_ADMIN']

export async function createRapidResponseForm(slug: string, warnNoticeId: string | null, employerName: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'workforce', WORKFORCE)
  if (!ctx) return { error: 'Only the workforce board, Exec Ed or an admin can create an offer.' }
  const title = str(f, 'title')
  const message = str(f, 'message')
  const programIds = f.getAll('programIds').map(String)
  if (!title) return { error: 'Give the offer a title.' }
  if (message.length < 20) return { error: 'Write a short message to the affected workers.' }
  const r = await createRapidResponse({ institutionId: ctx.institution.id, warnNoticeId, employerName, title, message, programIds, createdBy: ctx.email ?? ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_rapid_response_created', { institutionId: ctx.institution.id, rapidResponseId: r.id, programs: programIds.length })
  revalidatePath(`/i/${slug}/workforce`, 'layout')
  return { ok: true, message: 'Live. Share the sign-up link with the employer, the union or the board’s rapid response team.' }
}

export async function toggleRapidResponse(slug: string, id: string, isActive: boolean): Promise<Result> {
  const ctx = await staff(slug, 'workforce', WORKFORCE)
  if (!ctx) return { error: 'Only the workforce board, Exec Ed or an admin can change offers.' }
  await setRapidResponseActive(ctx.institution.id, id, isActive)
  captureServerEvent(ctx.userId, 'he_rapid_response_toggled', { institutionId: ctx.institution.id, rapidResponseId: id, isActive })
  revalidatePath(`/i/${slug}/workforce`, 'layout')
  return { message: isActive ? 'Reopened.' : 'Closed. The sign-up page now says so.' }
}
