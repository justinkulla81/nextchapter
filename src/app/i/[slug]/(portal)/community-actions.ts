'use server'

// Work, people, mentoring, learning, giving time, news, privacy requests and
// portal features. Members act as themselves; staff actions check the role
// that owns the feature; a switched-off feature refuses everything.

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspace, type WorkspaceContext } from '@/lib/higher-ed/access'
import type { AccessToken, WorkspaceKey } from '@/lib/higher-ed/workspaces'
import { MODULES, modulesFrom, type ModuleKey } from '@/lib/higher-ed/modules'
import {
  answerInterest,
  expressInterest,
  isGroupLeader,
  joinGroup,
  matchPair,
  postOpportunity,
  requestAudit,
  setOpportunityStatus,
  signUpForCohort,
} from '@/lib/higher-ed/community'
import { setConsent } from '@/lib/higher-ed/join'
import { completeRequest, deleteMemberRecord, openRequest } from '@/lib/higher-ed/data-requests'
import { collegeTimeZone, zonedToUtc } from '@/lib/higher-ed/time-zone'

type Result = { error?: string; ok?: boolean; message?: string }
export type FormResult = Result | undefined
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const int = (v: string) => (v && Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null)
const PREVIEW = 'You’re previewing; there’s no member record to act as.'
const OFF = 'Your college has switched this off.'

async function moduleOn(institutionId: string, key: ModuleKey) {
  const i = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  return modulesFrom(i.enabledFeatures)[key]
}
async function member(slug: string, key?: ModuleKey) {
  const ctx = await requireWorkspace(slug, 'candidate', { write: true })
  if (!ctx.memberId) return { error: PREVIEW } as const
  if (key && !(await moduleOn(ctx.institution.id, key))) return { error: OFF } as const
  return { ctx, memberId: ctx.memberId }
}
async function staff(slug: string, ws: WorkspaceKey, roles: AccessToken[]): Promise<WorkspaceContext | null> {
  const ctx = await requireWorkspace(slug, ws, { write: true })
  return roles.some((r) => ctx.tokens.has(r)) ? ctx : null
}
const ALUMNI: AccessToken[] = ['ALUMNI_RELATIONS', 'INSTITUTION_ADMIN']

// ── Projects and boards ─────────────────────────────────────────────────────

export async function postOpportunityForm(slug: string, as: 'member' | 'staff', _prev: FormResult, f: FormData): Promise<FormResult> {
  let institutionId: string, memberId: string | null = null, staffEmail: string | null = null, userId: string
  if (as === 'member') {
    const m = await member(slug, 'projects')
    if ('error' in m) return { error: m.error }
    institutionId = m.ctx.institution.id
    memberId = m.memberId
    userId = m.ctx.userId
  } else {
    const ctx = await staff(slug, 'alumni', ALUMNI)
    if (!ctx) return { error: 'Only Alumni Relations or an admin can post for the college.' }
    institutionId = ctx.institution.id
    staffEmail = ctx.email ?? ctx.userId
    userId = ctx.userId
  }
  const title = str(f, 'title')
  const organization = str(f, 'organization')
  const description = str(f, 'description')
  if (!title || !organization) return { error: 'Add a title and the organization.' }
  if (description.length < 30) return { error: 'Describe the work in a few sentences: what, for how long, what good looks like.' }
  const r = await postOpportunity({
    institutionId,
    memberId,
    staffEmail,
    kind: str(f, 'kind'),
    title,
    organization,
    description,
    skills: str(f, 'skills').split(',').map((s) => s.trim()).filter(Boolean),
    hoursPerWeek: int(str(f, 'hoursPerWeek')),
    durationWeeks: int(str(f, 'durationWeeks')),
    compensation: str(f, 'compensation'),
    location: str(f, 'location') || null,
  })
  if ('error' in r) return { error: r.error }
  captureServerEvent(userId, 'he_opportunity_posted', { institutionId, opportunityId: r.id, kind: str(f, 'kind'), as })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Posted. Fellow alumni can raise their hand; you choose who to connect with.' }
}

export async function interestedAction(slug: string, opportunityId: string, note: string): Promise<Result> {
  const m = await member(slug, 'projects')
  if ('error' in m) return { error: m.error }
  const r = await expressInterest(opportunityId, m.memberId, note)
  if ('error' in r) return { error: r.error }
  captureServerEvent(m.ctx.userId, 'he_opportunity_interest', { institutionId: m.ctx.institution.id, opportunityId })
  revalidatePath(`/i/${slug}/candidate/jobs`)
  return { ok: true, message: 'Sent. If they want to talk, you’ll see their email here.' }
}

export async function answerInterestAction(slug: string, interestId: string, connect: boolean): Promise<Result> {
  const m = await member(slug)
  if ('error' in m) return { error: m.error }
  const ok = await answerInterest(m.memberId, interestId, connect)
  captureServerEvent(m.ctx.userId, 'he_opportunity_interest_answered', { institutionId: m.ctx.institution.id, interestId, connect })
  revalidatePath(`/i/${slug}/candidate/jobs`)
  return ok ? { ok: true } : { error: 'That isn’t on one of your posts.' }
}

export async function closeOpportunity(slug: string, id: string, status: 'FILLED' | 'CLOSED', as: 'member' | 'staff'): Promise<Result> {
  let ok = false
  if (as === 'member') {
    const m = await member(slug)
    if ('error' in m) return { error: m.error }
    ok = await setOpportunityStatus(m.ctx.institution.id, id, status, m.memberId)
    captureServerEvent(m.ctx.userId, 'he_opportunity_closed', { institutionId: m.ctx.institution.id, opportunityId: id, status, as })
  } else {
    const ctx = await staff(slug, 'alumni', ALUMNI)
    if (!ctx) return { error: 'Only Alumni Relations or an admin can close posts.' }
    ok = await setOpportunityStatus(ctx.institution.id, id, status, null)
    captureServerEvent(ctx.userId, 'he_opportunity_closed', { institutionId: ctx.institution.id, opportunityId: id, status, as })
  }
  revalidatePath(`/i/${slug}`, 'layout')
  return ok ? { message: status === 'FILLED' ? 'Marked filled.' : 'Closed.' } : { error: 'That post is gone.' }
}

// ── Directory and groups ────────────────────────────────────────────────────

export async function setListed(slug: string, listed: boolean): Promise<Result> {
  const m = await member(slug, 'directory')
  if ('error' in m) return { error: m.error }
  await setConsent(m.memberId, 'LIST_IN_DIRECTORY', listed)
  captureServerEvent(m.ctx.userId, 'he_directory_listing_changed', { institutionId: m.ctx.institution.id, listed })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return { ok: true, message: listed ? 'You’re in the directory.' : 'You’re out of the directory.' }
}

export async function joinGroupAction(slug: string, groupId: string, join: boolean): Promise<Result> {
  const m = await member(slug, 'groups')
  if ('error' in m) return { error: m.error }
  const g = await prisma.alumniGroup.findFirst({ where: { id: groupId, institutionId: m.ctx.institution.id, isActive: true }, select: { id: true } })
  if (!g) return { error: 'That group is gone.' }
  await joinGroup(groupId, m.memberId, join)
  captureServerEvent(m.ctx.userId, 'he_group_joined', { institutionId: m.ctx.institution.id, groupId, join })
  revalidatePath(`/i/${slug}/candidate/people`)
  return { ok: true }
}

export async function createGroupForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations or an admin can add groups.' }
  const name = str(f, 'name')
  const kind = str(f, 'kind') === 'chapter' ? 'chapter' : 'affinity'
  if (!name) return { error: 'Name the group.' }
  const g = await prisma.alumniGroup.create({ data: { institutionId: ctx.institution.id, kind, name, description: str(f, 'description') || null, metro: kind === 'chapter' ? str(f, 'metro') || null : null, createdBy: ctx.email ?? ctx.userId }, select: { id: true } })
  // Optional first leader by roster email.
  const leaderEmail = str(f, 'leaderEmail').toLowerCase()
  if (leaderEmail) {
    const leader = await prisma.institutionMember.findFirst({ where: { institutionId: ctx.institution.id, email: leaderEmail }, select: { id: true } })
    if (leader) await prisma.alumniGroupMember.create({ data: { groupId: g.id, memberId: leader.id, role: 'LEADER' } })
  }
  captureServerEvent(ctx.userId, 'he_group_created', { institutionId: ctx.institution.id, groupId: g.id, kind })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: leaderEmail ? 'Added, with its leader.' : 'Added. Alumni can join from their People tab.' }
}

export async function setGroupLeader(slug: string, groupId: string, memberEmail: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations or an admin can name leaders.' }
  const m = await prisma.institutionMember.findFirst({ where: { institutionId: ctx.institution.id, email: memberEmail.trim().toLowerCase() }, select: { id: true } })
  if (!m) return { error: 'No one on the roster has that email.' }
  await prisma.alumniGroupMember.upsert({ where: { groupId_memberId: { groupId, memberId: m.id } }, create: { groupId, memberId: m.id, role: 'LEADER' }, update: { role: 'LEADER' } })
  captureServerEvent(ctx.userId, 'he_group_leader_set', { institutionId: ctx.institution.id, groupId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Leader added.' }
}

export async function archiveGroup(slug: string, groupId: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations or an admin can archive groups.' }
  await prisma.alumniGroup.updateMany({ where: { id: groupId, institutionId: ctx.institution.id }, data: { isActive: false } })
  captureServerEvent(ctx.userId, 'he_group_archived', { institutionId: ctx.institution.id, groupId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Archived.' }
}

// Group leaders add their own events (alumni-run chapters).
export async function leaderEventForm(slug: string, groupId: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const m = await member(slug, 'events')
  if ('error' in m) return { error: m.error }
  if (!(await isGroupLeader(groupId, m.memberId))) return { error: 'Only the group’s leaders can add its events.' }
  const title = str(f, 'title')
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: m.ctx.institution.id }, select: { enabledFeatures: true, profile: true } })
  const startsAt = str(f, 'date') && str(f, 'time') ? zonedToUtc(str(f, 'date'), str(f, 'time'), collegeTimeZone(inst.enabledFeatures, inst.profile)) : null
  if (!title) return { error: 'Give the event a title.' }
  if (!startsAt || startsAt < new Date()) return { error: 'Pick a future date and time.' }
  const e = await prisma.collegeEvent.create({ data: { institutionId: m.ctx.institution.id, groupId, title, kind: 'networking', startsAt, location: str(f, 'location') || null, createdBy: `member:${m.memberId}` }, select: { id: true } })
  captureServerEvent(m.ctx.userId, 'he_group_event_created', { institutionId: m.ctx.institution.id, groupId, eventId: e.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Added. It shows on the Events tab.' }
}

// ── Learning: course auditing ───────────────────────────────────────────────

const TEACH: AccessToken[] = ['FACULTY', 'EXEC_ED', 'INSTITUTION_ADMIN']

export async function auditCourseForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'teaching', TEACH)
  if (!ctx) return { error: 'Only faculty, Exec Ed or an admin can open a course to auditors.' }
  const title = str(f, 'title')
  const term = str(f, 'term')
  if (!title || !term) return { error: 'Add the course title and term.' }
  const facultyUserId = ctx.staffUsers.find((s) => s.role === 'FACULTY')?.id ?? null
  const c = await prisma.auditCourse.create({
    data: { institutionId: ctx.institution.id, title, term, courseCode: str(f, 'courseCode') || null, description: str(f, 'description') || null, schedule: str(f, 'schedule') || null, modality: str(f, 'modality') || null, seats: int(str(f, 'seats')), facultyUserId, skills: str(f, 'skills').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8) },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'he_audit_course_opened', { institutionId: ctx.institution.id, courseId: c.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Open to alumni auditors.' }
}

export async function decideAudit(slug: string, requestId: string, approve: boolean): Promise<Result> {
  const ctx = await staff(slug, 'teaching', TEACH)
  if (!ctx) return { error: 'Only faculty, Exec Ed or an admin can decide.' }
  const r = await prisma.auditRequest.updateMany({ where: { id: requestId, course: { institutionId: ctx.institution.id } }, data: { status: approve ? 'APPROVED' : 'DECLINED', decidedAt: new Date() } })
  captureServerEvent(ctx.userId, 'he_audit_decided', { institutionId: ctx.institution.id, requestId, approve })
  revalidatePath(`/i/${slug}`, 'layout')
  return r.count ? { ok: true } : { error: 'That request is gone.' }
}

export async function requestAuditAction(slug: string, courseId: string, note: string): Promise<Result> {
  const m = await member(slug, 'courseAuditing')
  if ('error' in m) return { error: m.error }
  const r = await requestAudit(courseId, m.memberId, note)
  if ('error' in r) return { error: r.error }
  captureServerEvent(m.ctx.userId, 'he_audit_requested', { institutionId: m.ctx.institution.id, courseId })
  revalidatePath(`/i/${slug}/candidate/programs`)
  return { ok: true, message: 'Requested. The instructor will let you know.' }
}

// ── Mentoring cohorts ───────────────────────────────────────────────────────

export async function cohortSignupAction(slug: string, cohortId: string, role: 'mentor' | 'mentee', goals: string): Promise<Result> {
  const m = await member(slug, 'mentoringCohorts')
  if ('error' in m) return { error: m.error }
  const mentorProfile = await prisma.institutionMentor.findUnique({ where: { memberId: m.memberId }, select: { industries: true } })
  const r = await signUpForCohort(cohortId, m.memberId, role, goals, mentorProfile?.industries ?? [])
  if ('error' in r) return { error: r.error }
  captureServerEvent(m.ctx.userId, 'he_mentoring_signup', { institutionId: m.ctx.institution.id, cohortId, role })
  revalidatePath(`/i/${slug}/candidate/mentors`)
  return { ok: true, message: 'You’re signed up. Alumni Relations will email you your match.' }
}

export async function createCohortForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'alumni', [...ALUMNI, 'CAREER_SERVICES'])
  if (!ctx) return { error: 'Only Alumni Relations, Career Services or an admin can start a program.' }
  const name = str(f, 'name')
  const startsAt = str(f, 'startsAt') ? new Date(`${str(f, 'startsAt')}T12:00:00Z`) : null
  const weeks = int(str(f, 'weeks')) ?? 12
  if (!name) return { error: 'Name the program.' }
  if (!startsAt || Number.isNaN(startsAt.getTime())) return { error: 'Pick a start date.' }
  const c = await prisma.mentoringCohort.create({ data: { institutionId: ctx.institution.id, name, theme: str(f, 'theme') || null, startsAt, weeks: Math.min(Math.max(weeks, 4), 52) }, select: { id: true } })
  captureServerEvent(ctx.userId, 'he_mentoring_cohort_created', { institutionId: ctx.institution.id, cohortId: c.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Open for sign-ups.' }
}

export async function matchAction(slug: string, cohortId: string, mentorMemberId: string, menteeMemberId: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', [...ALUMNI, 'CAREER_SERVICES'])
  if (!ctx) return { error: 'Only Alumni Relations, Career Services or an admin can match.' }
  const r = await matchPair(ctx.institution.id, cohortId, mentorMemberId, menteeMemberId, ctx.email ?? ctx.userId)
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_mentoring_matched', { institutionId: ctx.institution.id, cohortId })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Matched. Both got an email with each other’s address.' }
}

export async function rateMentoring(slug: string, pairId: string, rating: number): Promise<Result> {
  const m = await member(slug)
  if ('error' in m) return { error: m.error }
  if (!(rating >= 1 && rating <= 5)) return { error: 'Pick 1 to 5.' }
  const r = await prisma.mentoringPair.updateMany({ where: { id: pairId, menteeMemberId: m.memberId }, data: { menteeRating: rating, status: 'COMPLETED' } })
  captureServerEvent(m.ctx.userId, 'he_mentoring_rated', { institutionId: m.ctx.institution.id, pairId, rating })
  return r.count ? { ok: true, message: 'Thanks. That helps the next program.' } : { error: 'Only the mentee can rate.' }
}

// ── Ask an alum ─────────────────────────────────────────────────────────────

export async function askQuestion(slug: string, topic: string, body: string): Promise<Result> {
  const m = await member(slug, 'askAlumni')
  if ('error' in m) return { error: m.error }
  if (body.trim().length < 15) return { error: 'Ask a full question, so alumni know how to help.' }
  const recent = await prisma.alumniQuestion.count({ where: { memberId: m.memberId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } })
  if (recent >= 3) return { error: 'Three questions a day. Ask again tomorrow.' }
  const q = await prisma.alumniQuestion.create({ data: { institutionId: m.ctx.institution.id, memberId: m.memberId, topic: topic || 'general', body: body.trim().slice(0, 1500) }, select: { id: true } })
  captureServerEvent(m.ctx.userId, 'he_question_asked', { institutionId: m.ctx.institution.id, questionId: q.id, topic })
  revalidatePath(`/i/${slug}/candidate/people`)
  return { ok: true, message: 'Posted. Alumni in that field will see it.' }
}

export async function answerQuestion(slug: string, questionId: string, body: string): Promise<Result> {
  const m = await member(slug, 'askAlumni')
  if ('error' in m) return { error: m.error }
  if (body.trim().length < 10) return { error: 'Write a little more.' }
  const q = await prisma.alumniQuestion.findFirst({ where: { id: questionId, institutionId: m.ctx.institution.id, hiddenAt: null }, select: { id: true } })
  if (!q) return { error: 'That question is gone.' }
  const a = await prisma.alumniAnswer.create({ data: { questionId, memberId: m.memberId, body: body.trim().slice(0, 3000) }, select: { id: true } })
  captureServerEvent(m.ctx.userId, 'he_question_answered', { institutionId: m.ctx.institution.id, questionId, answerId: a.id })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return { ok: true, message: 'Thanks for helping.' }
}

export async function hideQuestion(slug: string, kind: 'question' | 'answer', id: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', [...ALUMNI, 'CAREER_SERVICES'])
  if (!ctx) return { error: 'Only staff can hide posts.' }
  if (kind === 'question') await prisma.alumniQuestion.updateMany({ where: { id, institutionId: ctx.institution.id }, data: { hiddenAt: new Date() } })
  else await prisma.alumniAnswer.updateMany({ where: { id, question: { institutionId: ctx.institution.id } }, data: { hiddenAt: new Date() } })
  captureServerEvent(ctx.userId, 'he_post_hidden', { institutionId: ctx.institution.id, kind, id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Hidden.' }
}

// ── Ways to give time ───────────────────────────────────────────────────────

export async function volunteerRoleForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'alumni', [...ALUMNI, 'CAREER_SERVICES', 'FACULTY'])
  if (!ctx) return { error: 'Only staff can add volunteer roles.' }
  const title = str(f, 'title')
  if (!title) return { error: 'Name the role.' }
  const r = await prisma.volunteerRole.create({
    data: { institutionId: ctx.institution.id, kind: str(f, 'kind') || 'other', title, description: str(f, 'description') || null, timeCommitment: str(f, 'timeCommitment') || null, office: str(f, 'office') || 'Alumni Relations', slots: int(str(f, 'slots')), createdBy: ctx.email ?? ctx.userId },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'he_volunteer_role_created', { institutionId: ctx.institution.id, roleId: r.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Added. Alumni see it on their Give back tab.' }
}

export async function volunteerSignupAction(slug: string, roleId: string, note: string, withdraw = false): Promise<Result> {
  const m = await member(slug, 'volunteer')
  if ('error' in m) return { error: m.error }
  const role = await prisma.volunteerRole.findFirst({ where: { id: roleId, institutionId: m.ctx.institution.id, isActive: true }, select: { slots: true, _count: { select: { signups: { where: { status: { not: 'WITHDREW' } } } } } } })
  if (!role) return { error: 'That role is closed.' }
  if (!withdraw && role.slots !== null && role._count.signups >= role.slots) return { error: 'It’s full. Thank you for offering.' }
  await prisma.volunteerSignup.upsert({
    where: { roleId_memberId: { roleId, memberId: m.memberId } },
    create: { roleId, memberId: m.memberId, note: note.slice(0, 500) || null },
    update: { status: withdraw ? 'WITHDREW' : 'SIGNED_UP', note: note.slice(0, 500) || null },
  })
  captureServerEvent(m.ctx.userId, 'he_volunteer_signup', { institutionId: m.ctx.institution.id, roleId, withdraw })
  revalidatePath(`/i/${slug}/candidate`, 'layout')
  return { ok: true, message: withdraw ? 'Withdrawn.' : 'Thank you. The office will be in touch.' }
}

export async function setVolunteerStatus(slug: string, signupId: string, status: 'CONFIRMED' | 'DONE'): Promise<Result> {
  const ctx = await staff(slug, 'alumni', [...ALUMNI, 'CAREER_SERVICES', 'FACULTY'])
  if (!ctx) return { error: 'Only staff can update volunteers.' }
  const s = await prisma.volunteerSignup.findFirst({ where: { id: signupId, role: { institutionId: ctx.institution.id } }, select: { id: true, memberId: true } })
  if (!s) return { error: 'That sign-up is gone.' }
  await prisma.volunteerSignup.update({ where: { id: s.id }, data: { status, completedAt: status === 'DONE' ? new Date() : null } })
  // Giving time is volunteer engagement (with the alum's consent).
  if (status === 'DONE') {
    const [c] = await prisma.$queryRaw<{ shareEngagement: boolean }[]>`select "shareEngagement" from private.v_member_consent where "memberId" = ${s.memberId}`
    if (c?.shareEngagement) await prisma.engagementEvent.createMany({ data: [{ institutionId: ctx.institution.id, memberId: s.memberId, type: 'EVENT', caseCategory: 'VOLUNTEER', points: 5, occurredAt: new Date(), sourceTable: 'VolunteerSignup', sourceId: s.id }], skipDuplicates: true })
  }
  captureServerEvent(ctx.userId, 'he_volunteer_status', { institutionId: ctx.institution.id, signupId, status })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// ── College news ────────────────────────────────────────────────────────────

export async function newsPostForm(slug: string, _prev: FormResult, f: FormData): Promise<FormResult> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations or an admin can post news.' }
  const title = str(f, 'title')
  const url = str(f, 'url')
  if (!title) return { error: 'Add a headline.' }
  if (url && !/^https?:\/\/\S+$/.test(url)) return { error: 'The link must start with https://.' }
  const p = await prisma.collegeNewsPost.create({ data: { institutionId: ctx.institution.id, title: title.slice(0, 160), body: str(f, 'body').slice(0, 2000) || null, url: url || null, createdBy: ctx.email ?? ctx.userId }, select: { id: true } })
  captureServerEvent(ctx.userId, 'he_news_posted', { institutionId: ctx.institution.id, postId: p.id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: 'Posted to alumni’s home page.' }
}

export async function deleteNewsPost(slug: string, id: string): Promise<Result> {
  const ctx = await staff(slug, 'alumni', ALUMNI)
  if (!ctx) return { error: 'Only Alumni Relations or an admin can remove news.' }
  await prisma.collegeNewsPost.deleteMany({ where: { id, institutionId: ctx.institution.id } })
  captureServerEvent(ctx.userId, 'he_news_deleted', { institutionId: ctx.institution.id, postId: id })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Removed.' }
}

// ── Portal features (Admin › Services) ──────────────────────────────────────

export async function setModule(slug: string, key: ModuleKey, on: boolean): Promise<Result> {
  const ctx = await staff(slug, 'admin', ['INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only a college admin can switch features.' }
  if (!MODULES.some((m) => m.key === key)) return { error: 'Unknown feature.' }
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const ef = (row.enabledFeatures ?? {}) as Record<string, unknown>
  await prisma.institution.update({ where: { id: ctx.institution.id }, data: { enabledFeatures: { ...ef, modules: { ...((ef.modules ?? {}) as Record<string, boolean>), [key]: on } } } })
  captureServerEvent(ctx.userId, 'he_module_switched', { institutionId: ctx.institution.id, module: key, on })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true }
}

// ── Privacy requests (FERPA) ────────────────────────────────────────────────

export async function memberDataRequest(slug: string, kind: 'CORRECT' | 'DELETE', note: string): Promise<Result> {
  const m = await member(slug)
  if ('error' in m) return { error: m.error }
  const me = await prisma.institutionMember.findUniqueOrThrow({ where: { id: m.memberId }, select: { email: true } })
  const open = await prisma.dataRequest.count({ where: { memberId: m.memberId, status: 'OPEN', kind } })
  if (open) return { error: 'You already have that request open. The college will reply by email.' }
  await openRequest({ institutionId: m.ctx.institution.id, memberId: m.memberId, email: me.email, kind, note: note.slice(0, 1000) || null, requestedBy: 'member' })
  captureServerEvent(m.ctx.userId, 'he_data_request_opened', { institutionId: m.ctx.institution.id, kind })
  return { ok: true, message: kind === 'DELETE' ? 'Sent. The college will confirm by email once your record is removed.' : 'Sent. The college will reply by email.' }
}

export async function completeDataRequest(slug: string, id: string): Promise<Result> {
  const ctx = await staff(slug, 'admin', ['INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only a college admin can close requests.' }
  const ok = await completeRequest(ctx.institution.id, id, ctx.email ?? ctx.userId)
  captureServerEvent(ctx.userId, 'he_data_request_completed', { institutionId: ctx.institution.id, requestId: id })
  revalidatePath(`/i/${slug}/admin/privacy`)
  return ok ? { message: 'Marked done.' } : { error: 'Already closed.' }
}

export async function deleteMemberAction(slug: string, memberId: string, requestId: string | null): Promise<Result> {
  const ctx = await staff(slug, 'admin', ['INSTITUTION_ADMIN'])
  if (!ctx) return { error: 'Only a college admin can delete a record.' }
  const r = await deleteMemberRecord({ institutionId: ctx.institution.id, memberId, by: ctx.email ?? ctx.userId, requestId })
  if ('error' in r) return { error: r.error }
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: 'Deleted. The request is logged as done.' }
}
