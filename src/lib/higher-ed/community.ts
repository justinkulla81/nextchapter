// The alumni community beyond a job search: projects and board seats posted
// alumni-to-alumni, the opt-in directory, affinity groups and chapters,
// "people like you", course auditing, learning paths, mentoring cohorts,
// Ask an alum, ways to give time and college news. Names other alumni see
// are their own choice: the directory lists only those who opted in, and
// titles and employers only for alumni who share their outcome.

import 'server-only'
import { Prisma, type JourneyType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { sendCampaign } from './outreach'

const DAY = 86_400_000
const full = (f: string | null, l: string | null) => [f, l].filter(Boolean).join(' ') || 'An alum'
const yr = (y: number | null) => (y ? ` ’${String(y).slice(2)}` : '')

// ── Projects, fractional roles, board seats ─────────────────────────────────

export const OPPORTUNITY_KINDS = [
  { key: 'project', label: 'Short project' },
  { key: 'fractional', label: 'Fractional role' },
  { key: 'board', label: 'Board seat' },
  { key: 'advisory', label: 'Advisory role' },
] as const
export const COMPENSATION = [
  { key: 'paid', label: 'Paid' },
  { key: 'equity', label: 'Equity' },
  { key: 'volunteer', label: 'Volunteer' },
] as const

export async function listOpportunities(institutionId: string, opts: { kind?: string; viewerMemberId?: string | null } = {}) {
  const now = new Date()
  const rows = await prisma.alumniOpportunity.findMany({
    where: { institutionId, status: 'OPEN', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], ...(opts.kind ? { kind: opts.kind } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      postedBy: { select: { id: true, firstName: true, lastName: true, classYear: true } },
      _count: { select: { interests: true } },
      interests: opts.viewerMemberId ? { where: { memberId: opts.viewerMemberId }, select: { status: true } } : false,
    },
  })
  return rows.map(({ interests, ...r }) => ({
    ...r,
    poster: r.postedBy ? `${full(r.postedBy.firstName, r.postedBy.lastName)}${yr(r.postedBy.classYear)}` : 'The college',
    mine: r.postedByMemberId === opts.viewerMemberId,
    myInterest: (interests as { status: string }[] | undefined)?.[0]?.status ?? null,
  }))
}

export async function postOpportunity(args: {
  institutionId: string
  memberId: string | null
  staffEmail: string | null
  kind: string
  title: string
  organization: string
  description: string
  skills: string[]
  hoursPerWeek: number | null
  durationWeeks: number | null
  compensation: string
  location: string | null
}) {
  if (!OPPORTUNITY_KINDS.some((k) => k.key === args.kind)) return { error: 'Pick what kind of opportunity it is.' }
  if (!COMPENSATION.some((c) => c.key === args.compensation)) return { error: 'Pick paid, equity or volunteer.' }
  if (args.memberId) {
    const open = await prisma.alumniOpportunity.count({ where: { postedByMemberId: args.memberId, status: 'OPEN' } })
    if (open >= 5) return { error: 'You have five open posts. Close one first.' }
  }
  const o = await prisma.alumniOpportunity.create({
    data: {
      institutionId: args.institutionId,
      postedByMemberId: args.memberId,
      postedByStaff: args.staffEmail,
      kind: args.kind,
      title: args.title.slice(0, 120),
      organization: args.organization.slice(0, 120),
      description: args.description.slice(0, 4000),
      skills: args.skills.slice(0, 10),
      hoursPerWeek: args.hoursPerWeek,
      durationWeeks: args.durationWeeks,
      compensation: args.compensation,
      location: args.location,
      expiresAt: new Date(Date.now() + 60 * DAY),
    },
    select: { id: true },
  })
  return { id: o.id }
}

export async function expressInterest(opportunityId: string, memberId: string, note: string) {
  const o = await prisma.alumniOpportunity.findUnique({ where: { id: opportunityId }, select: { status: true, postedByMemberId: true } })
  if (!o || o.status !== 'OPEN') return { error: 'That one has closed.' }
  if (o.postedByMemberId === memberId) return { error: 'That’s your own post.' }
  await prisma.opportunityInterest.upsert({
    where: { opportunityId_memberId: { opportunityId, memberId } },
    create: { opportunityId, memberId, note: note.slice(0, 1000) || null },
    update: { note: note.slice(0, 1000) || null },
  })
  return { ok: true }
}

// What a poster sees on their own posts: who's interested, emails once they connect.
export async function myPosts(memberId: string) {
  const posts = await prisma.alumniOpportunity.findMany({
    where: { postedByMemberId: memberId },
    orderBy: { createdAt: 'desc' },
    include: { interests: { orderBy: { createdAt: 'asc' }, include: { member: { select: { firstName: true, lastName: true, classYear: true, email: true } } } } },
  })
  return posts.map((p) => ({
    ...p,
    interests: p.interests.map((i) => ({ id: i.id, status: i.status, note: i.note, name: `${full(i.member.firstName, i.member.lastName)}${yr(i.member.classYear)}`, email: i.status === 'CONNECTED' ? i.member.email : null })),
  }))
}

export async function answerInterest(posterMemberId: string, interestId: string, connect: boolean) {
  const i = await prisma.opportunityInterest.findUnique({ where: { id: interestId }, select: { opportunity: { select: { postedByMemberId: true } } } })
  if (i?.opportunity.postedByMemberId !== posterMemberId) return false
  await prisma.opportunityInterest.update({ where: { id: interestId }, data: { status: connect ? 'CONNECTED' : 'DECLINED' } })
  return true
}

export async function setOpportunityStatus(institutionId: string, id: string, status: 'OPEN' | 'FILLED' | 'CLOSED', memberId: string | null) {
  const r = await prisma.alumniOpportunity.updateMany({ where: { id, institutionId, ...(memberId ? { postedByMemberId: memberId } : {}) }, data: { status } })
  return r.count > 0
}

// The poster's email, for the interested alum, once the poster connects.
export async function myInterests(memberId: string) {
  const rows = await prisma.opportunityInterest.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    include: { opportunity: { select: { title: true, organization: true, status: true, postedBy: { select: { firstName: true, lastName: true, email: true } } } } },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.opportunity.title,
    organization: r.opportunity.organization,
    status: r.status,
    poster: r.opportunity.postedBy ? full(r.opportunity.postedBy.firstName, r.opportunity.postedBy.lastName) : 'The college',
    email: r.status === 'CONNECTED' ? (r.opportunity.postedBy?.email ?? null) : null,
  }))
}

// ── The opt-in directory ─────────────────────────────────────────────────────

export type DirectoryEntry = { memberId: string; name: string; classYear: number | null; major: string | null; title: string | null; employer: string | null; metro: string | null; groups: string[] }

export async function isListed(memberId: string) {
  const [c] = await prisma.$queryRaw<{ granted: boolean }[]>`
    select granted from public."InstitutionConsent" where "memberId" = ${memberId} and scope = 'LIST_IN_DIRECTORY' order by "changedAt" desc, "createdAt" desc limit 1`
  return c?.granted === true
}

export async function searchDirectory(institutionId: string, f: { q?: string; classYear?: number | null; major?: string | null; metro?: string | null; groupId?: string | null }, limit = 40): Promise<DirectoryEntry[]> {
  const where: Prisma.Sql[] = [Prisma.sql`m."institutionId" = ${institutionId}`, Prisma.sql`m.status in ('CLAIMED', 'ACTIVE')`]
  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`
    where.push(Prisma.sql`(m."firstName" ilike ${like} or m."lastName" ilike ${like} or (m."firstName" || ' ' || m."lastName") ilike ${like} or d.employer ilike ${like} or d.title ilike ${like})`)
  }
  if (f.classYear) where.push(Prisma.sql`m."classYear" = ${f.classYear}`)
  if (f.major) where.push(Prisma.sql`m.major = ${f.major}`)
  if (f.metro) where.push(Prisma.sql`cp."metroArea" = ${f.metro}`)
  if (f.groupId) where.push(Prisma.sql`exists (select 1 from public."AlumniGroupMember" gm where gm."memberId" = m.id and gm."groupId" = ${f.groupId})`)
  const rows = await prisma.$queryRaw<(Omit<DirectoryEntry, 'name' | 'groups'> & { firstName: string | null; lastName: string | null })[]>`
    select m.id as "memberId", m."firstName", m."lastName", m."classYear", m.major, d.title, d.employer, cp."metroArea" as metro
    from public."InstitutionMember" m
    join lateral (
      select c.granted from public."InstitutionConsent" c
      where c."memberId" = m.id and c.scope = 'LIST_IN_DIRECTORY' order by c."changedAt" desc, c."createdAt" desc limit 1
    ) listed on listed.granted
    left join private.v_member_directory d on d."memberId" = m.id
    left join public."CandidateProfile" cp on cp.id = m."candidateId"
    where ${Prisma.join(where, ' and ')}
    order by m."lastName" nulls last, m."firstName" nulls last
    limit ${limit}`
  const groups = rows.length
    ? await prisma.alumniGroupMember.findMany({ where: { memberId: { in: rows.map((r) => r.memberId) } }, select: { memberId: true, group: { select: { name: true } } } })
    : []
  return rows.map(({ firstName, lastName, ...r }) => ({ ...r, name: full(firstName, lastName), groups: groups.filter((g) => g.memberId === r.memberId).map((g) => g.group.name) }))
}

// ── Affinity groups and chapters ─────────────────────────────────────────────

export async function listGroups(institutionId: string, memberId: string | null) {
  const groups = await prisma.alumniGroup.findMany({
    where: { institutionId, isActive: true },
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { members: true } },
      members: { where: { role: 'LEADER' }, select: { member: { select: { firstName: true, lastName: true, classYear: true } } } },
      events: { where: { cancelledAt: null, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 2, select: { id: true, title: true, startsAt: true } },
    },
  })
  const mine = memberId ? new Set((await prisma.alumniGroupMember.findMany({ where: { memberId }, select: { groupId: true, role: true } })).map((m) => m.groupId)) : new Set<string>()
  return groups.map((g) => ({ ...g, joined: mine.has(g.id), leaders: g.members.map((l) => `${full(l.member.firstName, l.member.lastName)}${yr(l.member.classYear)}`) }))
}

export async function joinGroup(groupId: string, memberId: string, join: boolean) {
  if (join) await prisma.alumniGroupMember.upsert({ where: { groupId_memberId: { groupId, memberId } }, create: { groupId, memberId }, update: {} })
  else await prisma.alumniGroupMember.deleteMany({ where: { groupId, memberId, role: 'MEMBER' } })
  return { ok: true }
}

export async function isGroupLeader(groupId: string, memberId: string) {
  return !!(await prisma.alumniGroupMember.findFirst({ where: { groupId, memberId, role: 'LEADER' }, select: { id: true } }))
}

// ── People like you ──────────────────────────────────────────────────────────

// What alumni with your major, or your current function, went on to do:
// the titles and employers at least two of them share, and what the career
// changers among them moved into. Counts only; groups under MIN_CELL_SIZE
// say nothing. (Work interests, the RIASEC module, can join this once it's
// built in NextChapter.)
export async function peopleLikeYou(institutionId: string, memberId: string) {
  const me = await prisma.institutionMember.findUnique({ where: { id: memberId }, select: { major: true, candidate: { select: { primaryFunction: true } } } })
  if (!me) return null
  const fn = me.candidate?.primaryFunction ?? null
  const rows = await prisma.$queryRaw<{ title: string | null; employer: string | null; journey: JourneyType | null; sameMajor: boolean; sameFunction: boolean }[]>`
    select d.title, d.employer, cp.journey,
      (m.major is not null and m.major = ${me.major ?? ''}) as "sameMajor",
      (cp."primaryFunction" is not null and cp."primaryFunction" = ${fn ?? ''}) as "sameFunction"
    from public."InstitutionMember" m
    join private.v_member_directory d on d."memberId" = m.id
    left join public."CandidateProfile" cp on cp.id = m."candidateId"
    where m."institutionId" = ${institutionId} and m.id <> ${memberId} and d."shareOutcome"
      and ((m.major is not null and m.major = ${me.major ?? ''}) or (cp."primaryFunction" is not null and cp."primaryFunction" = ${fn ?? ''}))`
  const top = (xs: (string | null)[]) => {
    const m = new Map<string, number>()
    for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1)
    return [...m.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, n]) => ({ label, n }))
  }
  const major = rows.filter((r) => r.sameMajor)
  const func = rows.filter((r) => r.sameFunction)
  const changers = func.filter((r) => r.journey === 'CAREER_CHANGE')
  return {
    major: me.major,
    fn,
    majorCount: major.length >= MIN_CELL_SIZE ? major.length : null,
    majorTitles: major.length >= MIN_CELL_SIZE ? top(major.map((r) => r.title)) : [],
    majorEmployers: major.length >= MIN_CELL_SIZE ? top(major.map((r) => r.employer)) : [],
    fnCount: func.length >= MIN_CELL_SIZE ? func.length : null,
    fnTitles: func.length >= MIN_CELL_SIZE ? top(func.map((r) => r.title)) : [],
    changers: changers.length >= MIN_CELL_SIZE ? changers.length : null,
  }
}

// ── Course auditing ──────────────────────────────────────────────────────────

export async function openAuditCourses(institutionId: string, memberId: string | null) {
  const rows = await prisma.auditCourse.findMany({
    where: { institutionId, isActive: true },
    orderBy: { title: 'asc' },
    include: {
      faculty: { select: { fullName: true, invitedEmail: true } },
      _count: { select: { requests: { where: { status: 'APPROVED' } } } },
      requests: memberId ? { where: { memberId }, select: { status: true } } : false,
    },
  })
  return rows.map(({ requests, ...c }) => ({ ...c, full: c.seats !== null && c._count.requests >= c.seats, myStatus: (requests as { status: string }[] | undefined)?.[0]?.status ?? null }))
}

export async function requestAudit(courseId: string, memberId: string, note: string) {
  const c = await prisma.auditCourse.findUnique({ where: { id: courseId }, select: { isActive: true, seats: true, _count: { select: { requests: { where: { status: 'APPROVED' } } } } } })
  if (!c?.isActive) return { error: 'That course isn’t open to auditors now.' }
  if (c.seats !== null && c._count.requests >= c.seats) return { error: 'Auditor seats are full.' }
  await prisma.auditRequest.upsert({ where: { courseId_memberId: { courseId, memberId } }, create: { courseId, memberId, note: note.slice(0, 500) || null }, update: { status: 'REQUESTED', note: note.slice(0, 500) || null } })
  return { ok: true }
}

// ── Learning paths by journey ────────────────────────────────────────────────

export const LEARNING_PATHS: Record<JourneyType, { title: string; steps: string[] }> = {
  LAID_OFF: { title: 'Back to work, stronger', steps: ['Take the Market Reality Grade to see your gaps', 'Close the biggest gap with a short program (WIOA or the Resilience Fund may pay)', 'Add the credential to LinkedIn and your Dossier', 'Apply with an alum’s intro'] },
  READY_TO_MOVE: { title: 'The next role', steps: ['Benchmark your skills against your target role', 'One credential that proves the gap is closed', 'Ask alumni at your target companies'] },
  EXPLORING_MOVE: { title: 'Stay ready', steps: ['Know your market and your worth', 'Audit a course in the field you’re curious about', 'One coffee chat a month with an alum'] },
  PROMOTION: { title: 'The next level', steps: ['Find the gap to the next level', 'A leadership program from Exec Ed', 'Log wins as they happen (In-work track)'] },
  CAREER_CHANGE: { title: 'Into a new field', steps: ['See what alumni in that field do', 'Audit a course, then a certificate in the new field', 'A capstone or project for proof', 'Three informational calls with alumni'] },
  STUDENT_NEW_GRAD: { title: 'Your first job', steps: ['Ask alumni in your target field', 'A short skills certificate employers ask for', 'Alumni-only jobs and internships'] },
  RETURNING: { title: 'Back after a break', steps: ['Refresh what changed in your field', 'A short program to update your skills', 'A mentor call, then applications'] },
  NEXT_ACT: { title: 'Your next act', steps: ['A board-readiness or nonprofit governance program', 'Board seats and fractional roles from alumni', 'Mentor alumni earlier in their careers'] },
}

// ── Mentoring cohorts ────────────────────────────────────────────────────────

export async function openMentoringCohorts(institutionId: string, memberId: string | null) {
  const cohorts = await prisma.mentoringCohort.findMany({
    where: { institutionId, startsAt: { gte: new Date(Date.now() - 120 * DAY) } },
    orderBy: { startsAt: 'asc' },
    include: {
      _count: { select: { signups: true, pairs: true } },
      signups: memberId ? { where: { memberId }, select: { role: true } } : false,
    },
  })
  const pairs = memberId
    ? await prisma.mentoringPair.findMany({
        where: { OR: [{ mentorMemberId: memberId }, { menteeMemberId: memberId }] },
        include: { cohort: { select: { name: true, startsAt: true, weeks: true } }, mentor: { select: { id: true, firstName: true, lastName: true, email: true } }, mentee: { select: { id: true, firstName: true, lastName: true, email: true } } },
      })
    : []
  return {
    cohorts: cohorts.map(({ signups, ...c }) => ({ ...c, myRole: (signups as { role: string }[] | undefined)?.[0]?.role ?? null })),
    pairs: pairs.map((p) => {
      const iAmMentor = p.mentorMemberId === memberId
      const other = iAmMentor ? p.mentee : p.mentor
      return { id: p.id, cohortId: p.cohortId, cohort: p.cohort.name, startsAt: p.cohort.startsAt, weeks: p.cohort.weeks, role: iAmMentor ? 'mentor' : 'mentee', with: full(other.firstName, other.lastName), email: other.email, status: p.status, rated: p.menteeRating !== null }
    }),
  }
}

export async function signUpForCohort(cohortId: string, memberId: string, role: 'mentor' | 'mentee', goals: string, industries: string[]) {
  const c = await prisma.mentoringCohort.findUnique({ where: { id: cohortId }, select: { signupsOpen: true } })
  if (!c?.signupsOpen) return { error: 'Sign-ups for this program have closed.' }
  await prisma.mentoringSignup.upsert({
    where: { cohortId_memberId: { cohortId, memberId } },
    create: { cohortId, memberId, role, goals: goals.slice(0, 1000) || null, industries: industries.slice(0, 6) },
    update: { role, goals: goals.slice(0, 1000) || null, industries: industries.slice(0, 6) },
  })
  return { ok: true }
}

// Staff matching: a suggested mentor for each unmatched mentee (shared
// industry first, then the mentor with the fewest mentees).
export async function suggestMatches(cohortId: string) {
  const [signups, pairs] = await Promise.all([
    prisma.mentoringSignup.findMany({ where: { cohortId }, include: { member: { select: { id: true, firstName: true, lastName: true, classYear: true } } } }),
    prisma.mentoringPair.findMany({ where: { cohortId }, select: { mentorMemberId: true, menteeMemberId: true } }),
  ])
  const mentors = signups.filter((s) => s.role === 'mentor')
  const matched = new Set(pairs.map((p) => p.menteeMemberId))
  const load = new Map(mentors.map((m) => [m.memberId, pairs.filter((p) => p.mentorMemberId === m.memberId).length]))
  return signups
    .filter((s) => s.role === 'mentee' && !matched.has(s.memberId))
    .map((mentee) => {
      const ranked = [...mentors].sort((a, b) => {
        const overlap = (x: typeof a) => x.industries.filter((i) => mentee.industries.includes(i)).length
        return overlap(b) - overlap(a) || (load.get(a.memberId) ?? 0) - (load.get(b.memberId) ?? 0)
      })
      const pick = ranked[0]
      return {
        menteeId: mentee.memberId,
        mentee: `${full(mentee.member.firstName, mentee.member.lastName)}${yr(mentee.member.classYear)}`,
        goals: mentee.goals,
        industries: mentee.industries,
        mentorId: pick?.memberId ?? null,
        mentor: pick ? `${full(pick.member.firstName, pick.member.lastName)}${yr(pick.member.classYear)}` : null,
        options: mentors.map((m) => ({ id: m.memberId, name: `${full(m.member.firstName, m.member.lastName)}${yr(m.member.classYear)}`, load: load.get(m.memberId) ?? 0 })),
      }
    })
}

export async function matchPair(institutionId: string, cohortId: string, mentorMemberId: string, menteeMemberId: string, createdBy: string) {
  const cohort = await prisma.mentoringCohort.findFirst({ where: { id: cohortId, institutionId }, select: { id: true, name: true } })
  if (!cohort) return { error: 'That program is gone.' }
  const ok = await prisma.mentoringSignup.count({ where: { cohortId, OR: [{ memberId: mentorMemberId, role: 'mentor' }, { memberId: menteeMemberId, role: 'mentee' }] } })
  if (ok !== 2) return { error: 'Both people need to have signed up, in those roles.' }
  await prisma.mentoringPair.upsert({ where: { cohortId_menteeMemberId: { cohortId, menteeMemberId } }, create: { cohortId, mentorMemberId, menteeMemberId }, update: { mentorMemberId } })
  // Each side learns who they're paired with, and the other's email.
  const [mentor, mentee] = await Promise.all([
    prisma.institutionMember.findUniqueOrThrow({ where: { id: mentorMemberId }, select: { firstName: true, lastName: true, email: true } }),
    prisma.institutionMember.findUniqueOrThrow({ where: { id: menteeMemberId }, select: { firstName: true, lastName: true, email: true } }),
  ])
  const body = `Hi {{firstName}},\n\nYou're matched in {{cohort}}: {{other}} ({{otherEmail}}). Say hello this week and set a time for your first conversation.\n\nYour {{college}} page: {{link}}`
  for (const [to, other] of [[menteeMemberId, mentor], [mentorMemberId, mentee]] as const) {
    await sendCampaign({
      institutionId,
      type: 'CUSTOM',
      subject: 'Your {{college}} mentoring match',
      body,
      createdBy,
      recipients: [{ memberId: to, extra: { cohort: cohort.name, other: full(other.firstName, other.lastName), otherEmail: other.email } }],
    })
  }
  return { ok: true }
}

// ── Ask an alum ──────────────────────────────────────────────────────────────

export async function listQuestions(institutionId: string, topic?: string | null) {
  const rows = await prisma.alumniQuestion.findMany({
    where: { institutionId, hiddenAt: null, ...(topic ? { topic } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      member: { select: { firstName: true, lastName: true, affiliation: true, classYear: true } },
      answers: { where: { hiddenAt: null }, orderBy: { createdAt: 'asc' }, include: { member: { select: { firstName: true, lastName: true, classYear: true } } } },
    },
  })
  return rows.map((q) => ({
    id: q.id,
    topic: q.topic,
    body: q.body,
    createdAt: q.createdAt,
    asker: `${q.member.firstName ?? 'A'} ${q.member.lastName?.[0] ?? ''}.${q.member.affiliation === 'STUDENT' ? ' (student)' : yr(q.member.classYear)}`,
    answers: q.answers.map((a) => ({ id: a.id, body: a.body, by: `${full(a.member.firstName, a.member.lastName)}${yr(a.member.classYear)}`, createdAt: a.createdAt })),
  }))
}

// ── Ways to give time ────────────────────────────────────────────────────────

export const VOLUNTEER_KINDS = [
  { key: 'admissions_interview', label: 'Admissions interviews' },
  { key: 'guest_lecture', label: 'Guest lecture' },
  { key: 'class_agent', label: 'Class agent' },
  { key: 'mentor_students', label: 'Mentor students' },
  { key: 'event_host', label: 'Host an event' },
  { key: 'other', label: 'Other' },
] as const

export async function listVolunteerRoles(institutionId: string, memberId: string | null) {
  const rows = await prisma.volunteerRole.findMany({
    where: { institutionId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { signups: { where: { status: { not: 'WITHDREW' } } } } }, signups: memberId ? { where: { memberId }, select: { status: true } } : false },
  })
  return rows.map(({ signups, ...r }) => ({ ...r, taken: r._count.signups, full: r.slots !== null && r._count.signups >= r.slots, myStatus: (signups as { status: string }[] | undefined)?.[0]?.status ?? null }))
}

// ── College news ─────────────────────────────────────────────────────────────

export async function collegeNews(institutionId: string, limit = 5) {
  return prisma.collegeNewsPost.findMany({ where: { institutionId, publishedAt: { lte: new Date() } }, orderBy: { publishedAt: 'desc' }, take: limit })
}
