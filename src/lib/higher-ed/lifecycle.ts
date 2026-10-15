// The college at every stage of an alum's move (Exploring → Preparing →
// Applying → Interviewing → Offer → Landed, and Paused): alumni intros at a
// company, the milestones feed, mentor office hours, events, class / major /
// metro groups, and programs matched to the gaps in their Market Reality
// report. Names shown to other alumni are first name, last initial and class;
// employers and titles only for alumni who share their outcome.

import { buildSkillMatrix } from '@/lib/profile/skill-matrix'
import 'server-only'
import { Prisma, type JourneyStage, type JourneyType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { sendCampaign } from './outreach'
import { openCohorts } from './programs'

const DAY = 86_400_000
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}
const shortName = (f: string | null, l: string | null) => [f, l ? `${l[0]}.` : null].filter(Boolean).join(' ') || 'An alum'

// ── Alumni intros at a company (Applying, Interviewing, Offer) ───────────────

export const INTRO_PURPOSES = [
  { key: 'exploring', label: 'Learning about the company' },
  { key: 'applying', label: 'Applying there' },
  { key: 'interviewing', label: 'Interviewing there' },
  { key: 'offer', label: 'Weighing an offer from them' },
  { key: 'referral', label: 'Asking for a referral for a role there' },
] as const
export type IntroPurpose = (typeof INTRO_PURPOSES)[number]['key']

// Joined alumni at the company who share their outcome (so it's their own
// choice that the college shows where they work), excluding the viewer.
export async function alumniAtCompany(institutionId: string, companyName: string, viewerMemberId: string | null) {
  const normalized = normalizeOrgName(companyName)
  const rows = await prisma.$queryRaw<{ memberId: string; firstName: string | null; lastName: string | null; classYear: number | null; title: string | null; employer: string }[]>`
    select d."memberId", d."firstName", d."lastName", d."classYear", d.title, d.employer
    from private.v_member_directory d
    where d."institutionId" = ${institutionId} and d."shareOutcome" and d.status in ('CLAIMED', 'ACTIVE') and d.employer is not null`
  return rows
    .filter((r) => r.memberId !== viewerMemberId && normalizeOrgName(r.employer) === normalized)
    .map((r) => ({ memberId: r.memberId, name: shortName(r.firstName, r.lastName), classYear: r.classYear, title: r.title }))
}

export const INTRO_SUBJECT = 'A fellow {{college}} alum would like a quick word about {{company}}'
export const INTRO_BODY = `Hi {{firstName}},

{{requester}}, a fellow {{college}} alum, is {{purpose}} and asked to talk with someone who works there. You came up because you share where you work with {{college}}.

"{{note}}"

Accept or decline on your {{college}} page (your email is shared only if you accept): {{link}}`

export async function requestAlumniIntro(args: { institutionId: string; requesterMemberId: string; targetMemberId: string; companyName: string; purpose: IntroPurpose; note: string; createdBy: string; referralJobUrl?: string | null }) {
  const jobUrl = args.referralJobUrl?.trim() || null
  if (args.purpose === 'referral' && jobUrl && !/^https?:\/\/\S+$/.test(jobUrl)) return { error: 'The job link must start with http.' }
  if (args.requesterMemberId === args.targetMemberId) return { error: 'That’s you.' }
  const eligible = (await alumniAtCompany(args.institutionId, args.companyName, args.requesterMemberId)).some((a) => a.memberId === args.targetMemberId)
  if (!eligible) return { error: 'They no longer share that they work there.' }
  const existing = await prisma.alumniIntroRequest.findUnique({
    where: { requesterMemberId_targetMemberId_companyName: { requesterMemberId: args.requesterMemberId, targetMemberId: args.targetMemberId, companyName: args.companyName } },
    select: { status: true },
  })
  if (existing) return { error: existing.status === 'DECLINED' ? 'They said not right now.' : 'You already asked them.' }
  // A fair limit: five open asks at a time.
  const open = await prisma.alumniIntroRequest.count({ where: { requesterMemberId: args.requesterMemberId, status: 'REQUESTED' } })
  if (open >= 5) return { error: 'You have five requests waiting. Give them a few days.' }
  const [req, requester, inst] = await Promise.all([
    prisma.alumniIntroRequest.create({
      data: { institutionId: args.institutionId, requesterMemberId: args.requesterMemberId, targetMemberId: args.targetMemberId, companyName: args.companyName, purpose: args.purpose, note: args.note.slice(0, 1000) || null, referralJobUrl: args.purpose === 'referral' ? jobUrl : null },
      select: { id: true },
    }),
    prisma.institutionMember.findUniqueOrThrow({ where: { id: args.requesterMemberId }, select: { firstName: true, lastName: true, classYear: true } }),
    prisma.institution.findUniqueOrThrow({ where: { id: args.institutionId }, select: { slug: true } }),
  ])
  const purpose = INTRO_PURPOSES.find((p) => p.key === args.purpose)!.label.toLowerCase()
  await sendCampaign({
    institutionId: args.institutionId,
    type: 'CUSTOM',
    subject: INTRO_SUBJECT,
    body: INTRO_BODY,
    createdBy: args.createdBy,
    recipients: [
      {
        memberId: args.targetMemberId,
        extra: {
          requester: `${[requester.firstName, requester.lastName].filter(Boolean).join(' ')}${requester.classYear ? ` '${String(requester.classYear).slice(2)}` : ''}`,
          company: args.companyName,
          purpose,
          note: args.note.slice(0, 500) || 'I’d value 15 minutes of your perspective.',
        },
      },
    ],
    linkFor: () => `${appUrl()}/i/${inst.slug}/candidate/network`,
  })
  return { id: req.id }
}

export async function answerAlumniIntro(targetMemberId: string, requestId: string, accept: boolean) {
  const r = await prisma.alumniIntroRequest.updateMany({
    where: { id: requestId, targetMemberId, status: 'REQUESTED' },
    data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })
  return r.count > 0
}

// Both sides of a member's intros; emails only once accepted.
export async function myAlumniIntros(memberId: string) {
  const [sent, received] = await Promise.all([
    prisma.alumniIntroRequest.findMany({
      where: { requesterMemberId: memberId },
      orderBy: { requestedAt: 'desc' },
      take: 20,
      select: { id: true, companyName: true, status: true, requestedAt: true, purpose: true, referredAt: true, target: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.alumniIntroRequest.findMany({
      where: { targetMemberId: memberId },
      orderBy: { requestedAt: 'desc' },
      take: 20,
      select: { id: true, companyName: true, purpose: true, note: true, status: true, requestedAt: true, referralJobUrl: true, referredAt: true, requester: { select: { firstName: true, lastName: true, classYear: true, email: true } } },
    }),
  ])
  return {
    sent: sent.map((s) => ({ id: s.id, companyName: s.companyName, status: s.status, referral: s.purpose === 'referral', referred: !!s.referredAt, name: shortName(s.target.firstName, s.target.lastName), email: s.status === 'ACCEPTED' ? s.target.email : null })),
    received: received.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      purpose: INTRO_PURPOSES.find((p) => p.key === r.purpose)?.label ?? r.purpose,
      note: r.note,
      status: r.status,
      name: `${[r.requester.firstName, r.requester.lastName].filter(Boolean).join(' ')}${r.requester.classYear ? ` '${String(r.requester.classYear).slice(2)}` : ''}`,
      email: r.status === 'ACCEPTED' ? r.requester.email : null,
      referral: r.purpose === 'referral',
      referralJobUrl: r.referralJobUrl,
      referred: !!r.referredAt,
    })),
  }
}

// Where the viewer could ask: companies with alumni who share, most first.
export async function companiesWithAlumni(institutionId: string, viewerMemberId: string | null, limit = 30) {
  const rows = await prisma.$queryRaw<{ employer: string; n: number }[]>`
    select d.employer, count(*)::int as n
    from private.v_member_directory d
    where d."institutionId" = ${institutionId} and d."shareOutcome" and d.status in ('CLAIMED', 'ACTIVE') and d.employer is not null
      and d."memberId" <> ${viewerMemberId ?? ''}
    group by d.employer order by n desc, d.employer limit ${limit}`
  return rows
}

// ── Milestones feed (Landed) ─────────────────────────────────────────────────

export type Milestone = { id: string; name: string; classYear: number | null; title: string | null; employer: string | null; reportedAt: Date }

// New jobs alumni chose to share as a milestone, with their outcome shared.
export async function listMilestones(institutionId: string, opts: { limit?: number; classYear?: number; major?: string } = {}): Promise<Milestone[]> {
  const rows = await prisma.$queryRaw<(Milestone & { firstName: string | null; lastName: string | null })[]>`
    select o.id, d."firstName", d."lastName", d."classYear", d.title, d.employer, o."reportedAt"
    from public."OutcomeReport" o
    join private.v_member_directory d on d."memberId" = o."memberId"
    join public."InstitutionMember" m on m.id = o."memberId"
    where d."institutionId" = ${institutionId} and o."shareMilestone" and d."shareOutcome"
      ${opts.classYear ? Prisma.sql`and d."classYear" = ${opts.classYear}` : Prisma.sql``}
      ${opts.major ? Prisma.sql`and m.major = ${opts.major}` : Prisma.sql``}
    order by o."reportedAt" desc
    limit ${opts.limit ?? 20}`
  return rows.map(({ firstName, lastName, ...r }) => ({ ...r, name: [firstName, lastName].filter(Boolean).join(' ') || 'An alum' }))
}


// ── Office hours (Preparing, Interviewing) ───────────────────────────────────

export async function mentorFor(memberId: string) {
  return prisma.institutionMentor.findUnique({ where: { memberId }, select: { id: true, institutionId: true, isActive: true } })
}

export async function addOfficeHours(args: { memberId: string; startsAt: Date; count: number; minutes: number; topic: string | null }) {
  const mentor = await mentorFor(args.memberId)
  if (!mentor?.isActive) return { error: 'Turn on mentoring on the Mentors tab first.' }
  if (args.startsAt.getTime() < Date.now() + 60 * 60 * 1000) return { error: 'Pick a time at least an hour from now.' }
  const count = Math.min(Math.max(Math.round(args.count) || 1, 1), 4)
  const minutes = [15, 20, 30].includes(args.minutes) ? args.minutes : 20
  await prisma.officeHourSlot.createMany({
    data: Array.from({ length: count }, (_, k) => ({ institutionId: mentor.institutionId, mentorId: mentor.id, startsAt: new Date(args.startsAt.getTime() + k * minutes * 60_000), minutes, topic: args.topic })),
  })
  return { added: count }
}

export async function openOfficeHours(institutionId: string, viewerMemberId: string | null, now = new Date()) {
  const rows = await prisma.officeHourSlot.findMany({
    where: { institutionId, startsAt: { gte: now, lte: new Date(now.getTime() + 30 * DAY) }, bookedByMemberId: null, cancelledAt: null, mentor: { isActive: true } },
    orderBy: { startsAt: 'asc' },
    take: 60,
    select: { id: true, startsAt: true, minutes: true, topic: true, mentor: { select: { memberId: true, industries: true, member: { select: { firstName: true, lastName: true, classYear: true } } } } },
  })
  return rows
    .filter((r) => r.mentor.memberId !== viewerMemberId)
    .map((r) => ({ id: r.id, startsAt: r.startsAt, minutes: r.minutes, topic: r.topic, industries: r.mentor.industries, name: shortName(r.mentor.member.firstName, r.mentor.member.lastName), classYear: r.mentor.member.classYear }))
}

export async function bookOfficeHour(args: { slotId: string; memberId: string; note: string }) {
  const slot = await prisma.officeHourSlot.findUnique({ where: { id: args.slotId }, select: { mentor: { select: { memberId: true } } } })
  if (slot?.mentor.memberId === args.memberId) return { error: 'That’s your own slot.' }
  const upcoming = await prisma.officeHourSlot.count({ where: { bookedByMemberId: args.memberId, startsAt: { gte: new Date() }, cancelledAt: null } })
  if (upcoming >= 2) return { error: 'You have two calls booked. Book another after one of them.' }
  // Only an open slot can be taken; two people clicking at once can't both get it.
  const r = await prisma.officeHourSlot.updateMany({
    where: { id: args.slotId, bookedByMemberId: null, cancelledAt: null, startsAt: { gte: new Date() } },
    data: { bookedByMemberId: args.memberId, bookedAt: new Date(), bookingNote: args.note.slice(0, 500) || null },
  })
  return r.count ? { ok: true } : { error: 'Someone just took that slot. Pick another.' }
}

export async function cancelOfficeHour(slotId: string, memberId: string) {
  const s = await prisma.officeHourSlot.findUnique({ where: { id: slotId }, select: { bookedByMemberId: true, mentor: { select: { memberId: true } } } })
  if (!s) return false
  if (s.mentor.memberId === memberId) {
    await prisma.officeHourSlot.update({ where: { id: slotId }, data: { cancelledAt: new Date() } })
    return true
  }
  if (s.bookedByMemberId === memberId) {
    await prisma.officeHourSlot.update({ where: { id: slotId }, data: { bookedByMemberId: null, bookedAt: null, bookingNote: null } })
    return true
  }
  return false
}

// A member's calls: the ones they booked and, if a mentor, their own slots.
export async function myOfficeHours(memberId: string, now = new Date()) {
  const [booked, hosting] = await Promise.all([
    prisma.officeHourSlot.findMany({
      where: { bookedByMemberId: memberId, cancelledAt: null, startsAt: { gte: new Date(now.getTime() - DAY) } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, minutes: true, mentor: { select: { member: { select: { firstName: true, lastName: true, email: true } } } } },
    }),
    prisma.officeHourSlot.findMany({
      where: { mentor: { memberId }, cancelledAt: null, startsAt: { gte: new Date(now.getTime() - DAY) } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, minutes: true, bookingNote: true, bookedBy: { select: { firstName: true, lastName: true, classYear: true, email: true } } },
    }),
  ])
  return {
    booked: booked.map((b) => ({ id: b.id, startsAt: b.startsAt, minutes: b.minutes, with: [b.mentor.member.firstName, b.mentor.member.lastName].filter(Boolean).join(' '), email: b.mentor.member.email })),
    hosting: hosting.map((h) => ({
      id: h.id,
      startsAt: h.startsAt,
      minutes: h.minutes,
      note: h.bookingNote,
      with: h.bookedBy ? `${[h.bookedBy.firstName, h.bookedBy.lastName].filter(Boolean).join(' ')}${h.bookedBy.classYear ? ` '${String(h.bookedBy.classYear).slice(2)}` : ''}` : null,
      email: h.bookedBy?.email ?? null,
    })),
  }
}

// ── Events (Exploring; counted as event engagement on check-in) ─────────────

export const EVENT_KINDS = [
  { key: 'panel', label: 'Career panel' },
  { key: 'employer_night', label: 'Employer night' },
  { key: 'workshop', label: 'Workshop' },
  { key: 'networking', label: 'Networking' },
] as const

export async function upcomingEvents(institutionId: string, memberId: string | null, now = new Date()) {
  const events = await prisma.collegeEvent.findMany({
    where: { institutionId, cancelledAt: null, startsAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) } },
    orderBy: { startsAt: 'asc' },
    take: 20,
    include: { _count: { select: { rsvps: { where: { status: 'GOING' } } } }, rsvps: memberId ? { where: { memberId }, select: { status: true } } : false },
  })
  return events.map(({ rsvps, _count, ...e }) => ({ ...e, going: _count.rsvps, mine: (rsvps as { status: string }[] | undefined)?.[0]?.status === 'GOING', full: e.capacity !== null && _count.rsvps >= e.capacity }))
}

export async function rsvp(eventId: string, memberId: string, going: boolean) {
  const e = await prisma.collegeEvent.findUnique({ where: { id: eventId }, select: { capacity: true, cancelledAt: true, _count: { select: { rsvps: { where: { status: 'GOING' } } } } } })
  if (!e || e.cancelledAt) return { error: 'That event was cancelled.' }
  if (going && e.capacity !== null && e._count.rsvps >= e.capacity) return { error: 'It’s full.' }
  await prisma.eventRsvp.upsert({
    where: { eventId_memberId: { eventId, memberId } },
    create: { eventId, memberId, status: going ? 'GOING' : 'CANCELLED' },
    update: { status: going ? 'GOING' : 'CANCELLED' },
  })
  return { ok: true }
}

export async function eventsForStaff(institutionId: string) {
  return prisma.collegeEvent.findMany({
    where: { institutionId },
    orderBy: { startsAt: 'desc' },
    take: 40,
    include: { rsvps: { where: { status: 'GOING' }, select: { id: true, checkedInAt: true, member: { select: { firstName: true, lastName: true, classYear: true } } } } },
  })
}

export async function checkIn(institutionId: string, rsvpId: string, on: boolean) {
  const r = await prisma.eventRsvp.updateMany({ where: { id: rsvpId, event: { institutionId } }, data: { checkedInAt: on ? new Date() : null } })
  return r.count > 0
}

// ── Groups: class, major, metro (Exploring) ──────────────────────────────────

export type Group = { key: string; kind: 'class' | 'major' | 'metro'; label: string; joined: number }

export async function myGroups(memberId: string): Promise<Group[]> {
  const m = await prisma.institutionMember.findUniqueOrThrow({
    where: { id: memberId },
    select: { institutionId: true, classYear: true, major: true, candidate: { select: { metroArea: true } } },
  })
  const joined = { status: { in: ['CLAIMED' as const, 'ACTIVE' as const] }, institutionId: m.institutionId }
  const groups: Group[] = []
  if (m.classYear) groups.push({ key: `class:${m.classYear}`, kind: 'class', label: `Class of ${m.classYear}`, joined: await prisma.institutionMember.count({ where: { ...joined, classYear: m.classYear } }) })
  if (m.major) groups.push({ key: `major:${m.major}`, kind: 'major', label: `${m.major} alumni`, joined: await prisma.institutionMember.count({ where: { ...joined, major: m.major } }) })
  if (m.candidate?.metroArea) {
    groups.push({ key: `metro:${m.candidate.metroArea}`, kind: 'metro', label: `${m.candidate.metroArea} alumni`, joined: await prisma.institutionMember.count({ where: { ...joined, candidate: { metroArea: m.candidate.metroArea } } }) })
  }
  return groups
}

// One group: where its alumni work (counts, at least two each; roster or
// shared NextChapter employer), its mentors, its milestones.
export async function groupView(institutionId: string, key: string) {
  const [kind, ...rest] = key.split(':')
  const value = rest.join(':')
  const where =
    kind === 'class' ? { classYear: Number(value) } : kind === 'major' ? { major: value } : kind === 'metro' ? { candidate: { metroArea: value } } : null
  if (!where || !value) return null
  const members = await prisma.institutionMember.findMany({ where: { institutionId, status: { not: 'OPTED_OUT' }, ...where }, select: { id: true } })
  const ids = members.map((x) => x.id)
  const employers = ids.length
    ? await prisma.$queryRaw<{ employer: string; n: number }[]>`
        select coalesce(d.employer, m."lastKnownEmployer") as employer, count(*)::int as n
        from public."InstitutionMember" m left join private.v_member_directory d on d."memberId" = m.id
        where m.id in (${Prisma.join(ids)}) and coalesce(d.employer, m."lastKnownEmployer") is not null
        group by 1 having count(*) >= 2 order by n desc limit 12`
    : []
  const mentors = await prisma.institutionMentor.count({ where: { institutionId, isActive: true, memberId: { in: ids } } })
  const milestones = kind === 'class' ? await listMilestones(institutionId, { classYear: Number(value), limit: 6 }) : kind === 'major' ? await listMilestones(institutionId, { major: value, limit: 6 }) : []
  return { kind, value, size: ids.length, employers, mentors, milestones }
}

// ── Programs matched to an alum's gaps (Exploring, Preparing) ────────────────

// Words from the latest Market Reality report's gap areas and the member's
// own growth areas, matched to each open cohort's program skills.
export async function programRecommendations(institutionId: string, candidateId: string | null) {
  const cohorts = await openCohorts(institutionId)
  if (!candidateId || !cohorts.length) return []
  const [report, profile] = await Promise.all([
    prisma.marketRealityReport.findFirst({ where: { candidateId }, orderBy: { generatedAt: 'desc' }, select: { gapAnalysis: true } }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { growthAreas: true, skillsToBuild: true, resumeKeywords: true, confirmedSkillsHave: true, certifications: true, skillLevels: true } }),
  ])
  const gaps = ((report?.gapAnalysis as { gaps?: { area?: string; remediation?: string }[] } | null)?.gaps ?? []).map((g) => `${g.area ?? ''} ${g.remediation ?? ''}`.toLowerCase())
  // Growth areas plus the skills the person said they want to build.
  const growth = [...(profile?.growthAreas ?? []), ...(profile?.skillsToBuild ?? [])].map((g) => g.replace(/_/g, ' ').toLowerCase())
  // Skills they already hold at strong or expert aren't worth a program.
  const held = new Set(profile ? buildSkillMatrix(profile).filter((r) => r.level !== 'used').map((r) => r.key) : [])
  const text = [...gaps, ...growth]
  if (!text.length) return []
  const out: { cohortId: string; program: string; cohort: string; startsAt: Date; skill: string; from: 'report' | 'growth' }[] = []
  const seen = new Set<string>()
  for (const c of cohorts) {
    for (const skill of c.program.skills) {
      const s = skill.toLowerCase()
      if (held.has(s)) continue
      const hitGap = gaps.some((g) => g.includes(s))
      const hitGrowth = growth.some((g) => g.includes(s))
      if ((hitGap || hitGrowth) && !seen.has(c.program.name)) {
        seen.add(c.program.name)
        out.push({ cohortId: c.id, program: c.program.name, cohort: c.name, startsAt: c.startsAt, skill, from: hitGap ? 'report' : 'growth' })
      }
    }
  }
  return out.slice(0, 3)
}

// ── What the college offers at each stage ───────────────────────────────────

export type StageHelp = { key: string; title: string; detail: string; href: string }

export function stageHelp(stage: JourneyStage | null, slug: string, opts: { hasPrograms: boolean; hasOfficeHours: boolean; hasEvents: boolean; hasJobs: boolean; journey?: JourneyType | null }): StageHelp[] {
  const b = `/i/${slug}/candidate`
  const items: Record<string, StageHelp> = {
    outcomes: { key: 'outcomes', title: 'What alumni like you do', detail: 'Where grads with your major work, and their milestones.', href: `${b}/network` },
    groups: { key: 'groups', title: 'Your class and city', detail: 'Where your classmates work, and who mentors.', href: `${b}/network` },
    events: { key: 'events', title: 'Career events', detail: 'Panels and employer nights. RSVP in one click.', href: `${b}/network#events` },
    programs: { key: 'programs', title: 'Close a gap', detail: 'Programs matched to your Market Reality report.', href: `${b}/programs` },
    officeHours: { key: 'officeHours', title: 'Book 20 minutes with a mentor', detail: 'Résumé, story, a mock interview.', href: `${b}/network#office-hours` },
    mentors: { key: 'mentors', title: 'Ask a mentor', detail: 'Alumni who’ll take your call.', href: `${b}/mentors` },
    jobs: { key: 'jobs', title: 'Alumni-only jobs', detail: 'Roles posted just for your college’s alumni.', href: `${b}/jobs` },
    intros: { key: 'intros', title: 'Get an intro', detail: 'An alum at the company you’re targeting.', href: `${b}/network#intros` },
    interview: { key: 'interview', title: 'Talk to someone inside', detail: 'An alum who works where you’re interviewing.', href: `${b}/network#intros` },
    offer: { key: 'offer', title: 'Sanity-check the offer', detail: 'An alum at that company, and your counselor.', href: `${b}/network#intros` },
    share: { key: 'share', title: 'Share your news', detail: 'Your milestone, if you want classmates to see it.', href: `${b}` },
    giveBack: { key: 'giveBack', title: 'Pay it forward', detail: 'Hold office hours or take a call.', href: `${b}/mentors` },
    // The In-work track (/dashboard/in-work) for people with a job.
    firstReview: { key: 'firstReview', title: 'Set up your first review', detail: 'Log wins as they happen, so your 90-day review writes itself.', href: '/dashboard/in-work?tab=impact' },
    promotion: { key: 'promotion', title: 'Plan the promotion', detail: 'The gap to the next level, a sponsor, and the conversation with your manager.', href: '/dashboard/in-work?tab=promotion' },
    worth: { key: 'worth', title: 'Know what you’re worth', detail: 'Your pay against the market, before you decide to move.', href: '/dashboard/in-work?tab=salary' },
  }
  const by: Record<JourneyStage, string[]> = {
    EXPLORING: ['outcomes', 'groups', 'events', 'programs'],
    PREPARING: ['programs', 'officeHours', 'mentors', 'groups'],
    APPLYING: ['jobs', 'intros', 'officeHours', 'events'],
    INTERVIEWING: ['interview', 'officeHours', 'mentors'],
    OFFER: ['offer', 'mentors'],
    LANDED: ['share', 'giveBack', 'groups'],
    STAYING: ['mentors', 'groups', 'programs'],
    PAUSED: [],
  }
  let keys = stage ? by[stage] : by.EXPLORING
  if (opts.journey === 'PROMOTION' && stage !== 'PAUSED' && stage !== 'STAYING' && stage !== 'LANDED') keys = ['promotion', ...keys]
  if (opts.journey === 'EXPLORING_MOVE' && stage === 'EXPLORING') keys = ['worth', ...keys]
  if (stage === 'LANDED') keys = ['firstReview', ...keys]
  return keys.slice(0, 4)
    .filter((k) => (k !== 'programs' || opts.hasPrograms) && (k !== 'officeHours' || opts.hasOfficeHours) && (k !== 'events' || opts.hasEvents) && (k !== 'jobs' || opts.hasJobs))
    .map((k) => items[k])
}
