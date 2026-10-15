'use server'

// Class notes, job-search circles, the virtual career fair, referrals and the
// monthly alumni email settings. Members act as themselves; staff actions
// check Alumni Relations (or Career Services for circles and fairs).

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'
import { getInstitutionAccess, requireWorkspace, type WorkspaceContext } from '@/lib/higher-ed/access'
import type { AccessToken, WorkspaceKey } from '@/lib/higher-ed/workspaces'
import { modulesFrom, type ModuleKey } from '@/lib/higher-ed/modules'
import { joinCircle, markReferred, postClassNote, visitBooth } from '@/lib/higher-ed/connect'
import { collegeTimeZone, zonedToUtc } from '@/lib/higher-ed/time-zone'
import { readMonthly, sendMonthlyEmail } from '@/lib/higher-ed/monthly'

type Result = { error?: string; ok?: boolean; message?: string }
export type FormResult = Result | undefined
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const PREVIEW = 'You’re previewing; there’s no member record to act as.'
const OFF = 'Your college has switched this off.'
const ALUMNI: AccessToken[] = ['ALUMNI_RELATIONS', 'INSTITUTION_ADMIN']
const CAREER_OR_ALUMNI: AccessToken[] = ['ALUMNI_RELATIONS', 'CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN']

async function member(slug: string, key?: ModuleKey) {
  const ctx = await requireWorkspace(slug, 'candidate', { write: true })
  if (!ctx.memberId) return { error: PREVIEW } as const
  if (key) {
    const i = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
    if (!modulesFrom(i.enabledFeatures)[key]) return { error: OFF } as const
  }
  return { ctx, memberId: ctx.memberId }
}
// Circles and fairs live in Alumni Relations and in Career Services: act in
// whichever of the two this person has.
async function alumniOrCareer(slug: string) {
  const access = await getInstitutionAccess(slug)
  const ws: WorkspaceKey = access && access !== 'signed-out' && access.workspaces.includes('alumni') ? 'alumni' : 'career'
  return staff(slug, ws, CAREER_OR_ALUMNI)
}
async function staff(slug: string, ws: WorkspaceKey, roles: AccessToken[]): Promise<WorkspaceContext | null> {
  const ctx = await requireWorkspace(slug, ws, { write: true })
  return roles.some((r) => ctx.tokens.has(r)) ? ctx : null
}

// ── Class notes ──
export async function classNoteAction(slug: string, kind: string, body: string): Promise<Result> {
  const m = await member(slug, 'classNotes')
  if ('error' in m) return { error: m.error }
  const r = await postClassNote(m.ctx.institution.id, m.memberId, kind, body)
  if (r.error) return r
  captureServerEvent(m.ctx.userId, 'he_class_note_posted', { institutionId: m.ctx.institution.id, kind })
  revalidatePath(`/i/${slug}/candidate/network`)
  return { ok: true, message: 'Posted to your class.' }
}
export async function hideClassNote(slug: string, id: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations or an admin can hide notes.' }
  await prisma.classNote.updateMany({ where: { id, institutionId: ctx.institution.id }, data: { hiddenAt: new Date() } })
  captureServerEvent(ctx.userId, 'he_class_note_hidden', { institutionId: ctx.institution.id, noteId: id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Hidden.' }
}

// ── Job-search circles ──
export async function circleForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await alumniOrCareer(slug)
  if (!ctx) return { error: 'Only Alumni Relations, Career Services or a coach can start a circle.' }
  const name = str(f, 'name')
  const date = str(f, 'startsAt')
  if (!name || !date) return { error: 'Add a name and a start date.' }
  const url = str(f, 'meetingUrl')
  if (url && !/^https?:\/\/\S+$/.test(url)) return { error: 'The meeting link must start with https://.' }
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true, profile: true } })
  const startsAt = zonedToUtc(date, '12:00', collegeTimeZone(inst.enabledFeatures, inst.profile))
  if (!startsAt) return { error: 'That date doesn’t look right.' }
  const weeks = Math.min(12, Math.max(2, Number(str(f, 'weeks')) || 6))
  const capacity = Math.min(12, Math.max(3, Number(str(f, 'capacity')) || 6))
  const c = await prisma.jobSearchCircle.create({
    data: { institutionId: ctx.institution.id, name: name.slice(0, 100), focus: str(f, 'focus').slice(0, 200) || null, facilitator: str(f, 'facilitator').slice(0, 80) || ctx.email || 'Career Services', startsAt, weeks, meetingTime: str(f, 'meetingTime').slice(0, 80) || null, meetingUrl: url || null, capacity, createdBy: ctx.email ?? ctx.userId },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'he_circle_created', { institutionId: ctx.institution.id, circleId: c.id, weeks, capacity })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Circle open for sign-ups.' }
}
export async function joinCircleAction(slug: string, circleId: string, goal: string, leave = false): Promise<Result> {
  const m = await member(slug, 'circles')
  if ('error' in m) return { error: m.error }
  const ok = await prisma.jobSearchCircle.count({ where: { id: circleId, institutionId: m.ctx.institution.id } })
  if (!ok) return { error: 'That circle is gone.' }
  const r = await joinCircle(circleId, m.memberId, goal, leave)
  if (r.error) return r
  captureServerEvent(m.ctx.userId, leave ? 'he_circle_left' : 'he_circle_joined', { institutionId: m.ctx.institution.id, circleId })
  revalidatePath(`/i/${slug}/candidate/network`)
  return { ok: true, message: leave ? 'You left the circle.' : 'You’re in. The facilitator will send the first meeting details.' }
}

// ── Career fair ──
export async function careerFairForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await alumniOrCareer(slug)
  if (!ctx) return { error: 'Only Alumni Relations, Career Services or an admin can set up a fair.' }
  const title = str(f, 'title')
  const date = str(f, 'date')
  if (!title || !date) return { error: 'Add a name and a date.' }
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true, profile: true } })
  const startsAt = zonedToUtc(date, str(f, 'time') || '12:00', collegeTimeZone(inst.enabledFeatures, inst.profile))
  if (!startsAt) return { error: 'That date or time doesn’t look right.' }
  const e = await prisma.collegeEvent.create({ data: { institutionId: ctx.institution.id, title: title.slice(0, 120), kind: 'career_fair', startsAt, location: 'Online', createdBy: ctx.email ?? ctx.userId }, select: { id: true } })
  captureServerEvent(ctx.userId, 'he_career_fair_created', { institutionId: ctx.institution.id, eventId: e.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Fair created. Add employer booths below.' }
}
export async function boothForm(slug: string, eventId: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await alumniOrCareer(slug)
  if (!ctx) return { error: 'Only Alumni Relations, Career Services or an admin can add booths.' }
  const ev = await prisma.collegeEvent.count({ where: { id: eventId, institutionId: ctx.institution.id, kind: 'career_fair' } })
  if (!ev) return { error: 'That fair is gone.' }
  const employerName = str(f, 'employerName')
  if (!employerName) return { error: 'Add the employer’s name.' }
  const url = str(f, 'meetingUrl')
  if (url && !/^https?:\/\/\S+$/.test(url)) return { error: 'The meeting link must start with https://.' }
  await prisma.fairBooth.create({ data: { eventId, employerName: employerName.slice(0, 120), pitch: str(f, 'pitch').slice(0, 1000) || null, roles: str(f, 'roles').slice(0, 1000) || null, meetingUrl: url || null } })
  captureServerEvent(ctx.userId, 'he_fair_booth_added', { institutionId: ctx.institution.id, eventId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Booth added.' }
}
export async function visitBoothAction(slug: string, boothId: string, note: string, shareDossier: boolean): Promise<Result> {
  const m = await member(slug, 'careerFair')
  if ('error' in m) return { error: m.error }
  const ok = await prisma.fairBooth.count({ where: { id: boothId, event: { institutionId: m.ctx.institution.id } } })
  if (!ok) return { error: 'That booth is gone.' }
  await visitBooth(boothId, m.memberId, note, shareDossier)
  captureServerEvent(m.ctx.userId, 'he_fair_booth_visited', { institutionId: m.ctx.institution.id, boothId, shareDossier })
  return { ok: true, message: shareDossier ? 'They’ll see your note and your Dossier.' : 'They’ll see your name and note.' }
}

// ── Referrals ──
export async function markReferredAction(slug: string, introId: string): Promise<Result> {
  const m = await member(slug)
  if ('error' in m) return { error: m.error }
  const r = await markReferred(m.memberId, introId)
  if (r.error) return r
  captureServerEvent(m.ctx.userId, 'he_alumni_referral_made', { institutionId: m.ctx.institution.id, introId })
  revalidatePath(`/i/${slug}/candidate/network`)
  return { ok: true, message: 'Marked referred. Thank you.' }
}

// ── Monthly alumni email ──
export async function saveMonthlyEmail(slug: string, on: boolean, day: number): Promise<Result> {
  const ctx = await staff(slug, 'admin', ['INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only a college admin can change the monthly email.' }
  if (!(day >= 1 && day <= 28)) return { error: 'Pick a day from 1 to 28.' }
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const ef = (row.enabledFeatures ?? {}) as Record<string, unknown>
  await prisma.institution.update({ where: { id: ctx.institution.id }, data: { enabledFeatures: { ...ef, monthly: { ...readMonthly(row.enabledFeatures), on, day } } } })
  captureServerEvent(ctx.userId, 'he_monthly_email_saved', { institutionId: ctx.institution.id, on, day })
  revalidatePath(`/i/${slug}/admin/services`)
  return { ok: true, message: on ? `On. It goes out on day ${day} of each month.` : 'Off.' }
}
export async function sendMonthlyTest(slug: string): Promise<Result> {
  const ctx = await staff(slug, 'admin', ['INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only a college admin can send a test.' }
  if (!ctx.memberId) return { error: 'You need an alumni record at this college to receive a test. Ask NextChapter to add you to the roster.' }
  const r = await sendMonthlyEmail(ctx.institution.id, { onlyMemberIds: [ctx.memberId], createdBy: ctx.email ?? ctx.userId })
  captureServerEvent(ctx.userId, 'he_monthly_email_test', { institutionId: ctx.institution.id, sent: r.sent })
  return r.demo ? { message: 'Demo college: nothing is emailed. The email is logged in Alumni Relations › Outreach.' } : { message: r.sent ? 'Test sent to your inbox.' : 'Nothing sent: check your email isn’t unsubscribed.' }
}
