// Demo data for the alumni community: projects and board seats, directory
// listings, groups and chapters, an audit course, a mentoring program, Ask
// an alum, volunteer roles, college news, and the demo multi-campus system.
// Called at the end of resetDemoInstitution; everything is isSampleData and
// goes when the demo college is deleted (cascade).

import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { DemoTenant } from './demo-tenants'

type Db = PrismaClient | Prisma.TransactionClient
const DAY = 86_400_000
const S = { isSampleData: true } as const

export const DEMO_SYSTEM_SLUG = 'nextchapter-demo-system'

export async function seedCommunity(
  db: Db,
  a: {
    institutionId: string
    tenant: DemoTenant
    now: Date
    joined: string[] // member ids, joined alumni
    featured: string // the "Preview as alum" member
    student: string | null
    facultyUserId: string | null
    employers: string[]
  },
) {
  const { institutionId, tenant, now, joined, featured } = a
  const others = joined.filter((m) => m !== featured)
  const o = (k: number) => others[k % others.length]
  const ago = (d: number) => new Date(now.getTime() - d * DAY)

  // Directory: about two in three joined alumni list themselves, the featured alum included.
  const listed = [featured, ...others.filter((_, k) => k % 3 !== 2)]
  await db.institutionConsent.createMany({ data: listed.map((memberId) => ({ memberId, scope: 'LIST_IN_DIRECTORY' as const, granted: true, source: 'MEMBER', ...S })), skipDuplicates: true })

  // Projects and board seats. The featured alum posted one, with interest waiting.
  const opp = (x: Omit<Prisma.AlumniOpportunityCreateManyInput, 'institutionId' | 'expiresAt' | 'isSampleData'>, d: number) => ({ ...x, institutionId, createdAt: ago(d), expiresAt: new Date(ago(d).getTime() + 60 * DAY), ...S })
  const created = await Promise.all(
    [
      opp({ postedByMemberId: featured, kind: 'project', title: 'Build our first operations dashboard', organization: 'Northside Logistics', description: 'We track deliveries in three spreadsheets. Six weeks to pull them into one dashboard the dispatch team will actually use.', skills: ['SQL', 'Excel', 'Power BI'], hoursPerWeek: 8, durationWeeks: 6, compensation: 'paid', location: 'Remote' }, 6),
      opp({ postedByMemberId: o(1), kind: 'board', title: 'Board seat: finance committee chair', organization: 'Southwestern PA Food Bank', description: 'Three-year term, monthly board meeting, quarterly finance committee. CPA or CFO background preferred.', skills: ['Finance', 'Governance'], hoursPerWeek: 3, durationWeeks: null, compensation: 'volunteer', location: 'Pittsburgh' }, 10),
      opp({ postedByMemberId: o(2), kind: 'fractional', title: 'Fractional head of marketing', organization: 'Keystone Robotics', description: 'Two days a week to set positioning, hire one marketer and run our first trade show.', skills: ['B2B marketing', 'Hiring'], hoursPerWeek: 16, durationWeeks: 24, compensation: 'equity', location: 'Hybrid, Pittsburgh' }, 14),
      opp({ postedByMemberId: null, postedByStaff: 'demo-seed', kind: 'advisory', title: `${tenant.name} Career Advisory Council`, organization: tenant.name, description: 'Twice a year, help the career office decide which employer partnerships and programs to build next.', skills: ['Hiring', 'Industry insight'], hoursPerWeek: 1, durationWeeks: null, compensation: 'volunteer', location: 'Remote' }, 20),
      opp({ postedByMemberId: o(3), kind: 'project', title: 'Grant application for a STEM summer camp', organization: 'Mon Valley Youth Science', description: 'Write a $50k foundation grant: narrative, budget and outcomes. Due in five weeks.', skills: ['Grant writing'], hoursPerWeek: 5, durationWeeks: 5, compensation: 'paid', location: 'Remote' }, 3),
    ].map((data) => db.alumniOpportunity.create({ data, select: { id: true } })),
  )
  await db.opportunityInterest.createMany({
    data: [
      { opportunityId: created[0].id, memberId: o(4), note: 'I built the same thing for a regional carrier last year.', ...S },
      { opportunityId: created[0].id, memberId: o(5), note: 'Power BI certified; free evenings and weekends.', ...S },
      { opportunityId: created[1].id, memberId: featured, note: 'I chaired the audit committee at my last nonprofit.', status: 'CONNECTED', ...S },
      { opportunityId: created[2].id, memberId: o(6), ...S },
    ],
  })

  // Groups and chapters. The featured alum leads the Pittsburgh chapter.
  const groupDefs = [
    { kind: 'chapter', name: 'Pittsburgh Chapter', metro: 'Pittsburgh', description: 'Happy hours, a fall service day and the spring career night.' },
    { kind: 'chapter', name: 'Washington, DC Chapter', metro: 'Washington, DC', description: 'Policy breakfasts and an annual networking reception on the Hill.' },
    { kind: 'affinity', name: 'Women in Business', metro: null, description: 'Mentoring circles and a speaker series for alumnae in business.' },
    { kind: 'affinity', name: 'First-Generation Alumni', metro: null, description: 'For alumni who were the first in their family to go to college.' },
    { kind: 'affinity', name: 'Health Professions Network', metro: null, description: 'Physicians, nurses, researchers and administrators, plus pre-health students.' },
  ]
  const groups = await Promise.all(groupDefs.map((g) => db.alumniGroup.create({ data: { ...g, institutionId, createdBy: 'demo-seed', ...S }, select: { id: true } })))
  const gm: Prisma.AlumniGroupMemberCreateManyInput[] = [{ groupId: groups[0].id, memberId: featured, role: 'LEADER', ...S }, { groupId: groups[3].id, memberId: featured, ...S }]
  others.forEach((m, k) => {
    gm.push({ groupId: groups[k % 5].id, memberId: m, role: k < 5 && k % 5 !== 0 ? 'LEADER' : 'MEMBER', ...S })
    if (k % 4 === 0) gm.push({ groupId: groups[(k + 2) % 5].id, memberId: m, ...S })
  })
  await db.alumniGroupMember.createMany({ data: gm, skipDuplicates: true })
  await db.collegeEvent.create({
    data: { institutionId, groupId: groups[0].id, title: 'Pittsburgh Chapter fall happy hour', kind: 'networking', startsAt: new Date(Math.floor((now.getTime() + 16 * DAY) / DAY) * DAY + 22 * 3600_000), location: 'Market Square, Pittsburgh', createdBy: 'demo-seed', ...S },
  })

  // Course auditing.
  const courses = await Promise.all(
    [
      { title: 'Behavioral Economics', courseCode: 'ECO 340', term: 'Spring 2027', schedule: 'Tue/Thu 2:00–3:15', modality: 'in_person', seats: 4, description: 'Why people don’t do what models predict, and what that means for policy and product design.', skills: ['Economics', 'Decision making'] },
      { title: 'Data Visualization', courseCode: 'CIS 255', term: 'Spring 2027', schedule: 'Online, weekly', modality: 'online', seats: 6, description: 'Turning data into charts people understand. Tableau and Python.', skills: ['Data visualization', 'Python', 'Tableau'] },
    ].map((c) => db.auditCourse.create({ data: { ...c, institutionId, facultyUserId: a.facultyUserId, ...S }, select: { id: true } })),
  )
  await db.auditRequest.createMany({
    data: [
      { courseId: courses[1].id, memberId: featured, note: 'Analyst roles want visualization; I’d like the real thing, not a video course.', ...S },
      { courseId: courses[1].id, memberId: o(7), status: 'APPROVED', decidedAt: ago(4), ...S },
      { courseId: courses[0].id, memberId: o(8), note: 'Product manager, curious about nudges.', ...S },
    ],
  })

  // A mentoring program: signups, two matches, one mentee waiting.
  const cohort = await db.mentoringCohort.create({ data: { institutionId, name: 'Fall mentoring: career changers', theme: 'Moving into a new field', startsAt: ago(10), weeks: 12, ...S }, select: { id: true } })
  const fields = ['Healthcare', 'Finance', 'Technology', 'Education']
  const mentors = [o(9), o(10), o(11)]
  const mentees = [featured, o(12), o(13), o(14)]
  await db.mentoringSignup.createMany({
    data: [
      ...mentors.map((m, k) => ({ cohortId: cohort.id, memberId: m, role: 'mentor', goals: 'Happy to help someone make the jump I made.', industries: [fields[k], fields[(k + 1) % 4]], ...S })),
      ...mentees.map((m, k) => ({ cohortId: cohort.id, memberId: m, role: 'mentee', goals: k === 0 ? 'Move from operations into data analysis.' : 'Figure out which roles fit my background.', industries: [fields[(k + 2) % 4]], ...S })),
    ],
  })
  await db.mentoringPair.createMany({
    data: [
      { cohortId: cohort.id, mentorMemberId: mentors[2], menteeMemberId: featured, ...S },
      { cohortId: cohort.id, mentorMemberId: mentors[0], menteeMemberId: mentees[1], ...S },
    ],
  })
  await db.mentoringCohort.create({ data: { institutionId, name: 'Spring mentoring: first jobs', theme: 'Students and recent grads', startsAt: new Date(now.getTime() + 75 * DAY), weeks: 10, ...S } })

  // Ask an alum.
  const asker = a.student ?? o(15)
  const q1 = await db.alumniQuestion.create({ data: { institutionId, memberId: asker, topic: tenant.majors[0], body: 'For econ majors who went into consulting: did you recruit through on-campus interviews or networking? What would you do differently?', createdAt: ago(5), ...S }, select: { id: true } })
  const q2 = await db.alumniQuestion.create({ data: { institutionId, memberId: o(16), topic: 'general', body: 'Has anyone moved from teaching into instructional design? How long did it take, and was a certificate worth it?', createdAt: ago(2), ...S }, select: { id: true } })
  await db.alumniQuestion.create({ data: { institutionId, memberId: o(17), topic: tenant.majors[1], body: 'Is a master’s worth it for a lab research job, or is two years as a tech the better path?', createdAt: ago(1), ...S } })
  await db.alumniAnswer.createMany({
    data: [
      { questionId: q1.id, memberId: o(18), body: 'Networking, without question. Two alumni referrals got me both of my interviews. Start in sophomore spring.', createdAt: ago(4), ...S },
      { questionId: q1.id, memberId: o(19), body: 'On-campus worked for me, but the case prep group mattered more than anything else.', createdAt: ago(3), ...S },
      { questionId: q2.id, memberId: o(20), body: 'About eight months. The certificate helped less than a portfolio of three real course builds.', createdAt: ago(1), ...S },
    ],
  })

  // Ways to give time.
  const roles = await Promise.all(
    [
      { kind: 'admissions_interview', title: 'Interview applicants in your city', office: 'Admissions', timeCommitment: 'Two hours a month, November–February', slots: 25, description: 'Thirty-minute conversations with applicants near you, by video or over coffee. Training takes 45 minutes.' },
      { kind: 'guest_lecture', title: 'Speak to a class in your field', office: 'Career Services', timeCommitment: 'One class session', slots: 10, description: 'Faculty want alumni to show students what the work looks like. In person or by video.' },
      { kind: 'class_agent', title: 'Class agent for your reunion year', office: 'Alumni Relations', timeCommitment: 'An hour a month', slots: null, description: 'Keep your classmates in touch and help plan the reunion.' },
    ].map((r) => db.volunteerRole.create({ data: { ...r, institutionId, createdBy: 'demo-seed', ...S }, select: { id: true } })),
  )
  await db.volunteerSignup.createMany({
    data: [
      ...[21, 22, 23].map((k, j) => ({ roleId: roles[0].id, memberId: o(k), status: j === 0 ? 'DONE' : j === 1 ? 'CONFIRMED' : 'SIGNED_UP', completedAt: j === 0 ? ago(30) : null, ...S })),
      { roleId: roles[1].id, memberId: o(24), note: 'Happy to talk about hospital administration.', ...S },
      { roleId: roles[2].id, memberId: featured, status: 'CONFIRMED', ...S },
    ],
  })

  // College news.
  await db.collegeNewsPost.createMany({
    data: [
      { title: 'New data analytics certificate opens to alumni', body: 'Eight weeks online, taught by the economics faculty. Alumni get 30% off.', publishedAt: ago(2) },
      { title: 'Career night: 40 employers on campus November 12', body: 'Alumni are welcome. Bring a résumé; recruiters from three alumni-led companies are hiring.', publishedAt: ago(9) },
      { title: `${tenant.name} named a top college for social mobility`, body: null, publishedAt: ago(21) },
    ].map((n) => ({ ...n, institutionId, createdBy: 'demo-seed', ...S })),
  })

  // Class notes, a job-search circle, a career fair with booths, and a referral.
  await db.classNote.createMany({
    data: [
      { institutionId, memberId: o(25), kind: 'career', body: 'Started as VP of Operations at a regional health system this month. Grateful to the two alumni who took my calls.', createdAt: ago(3), ...S },
      { institutionId, memberId: o(26), kind: 'life', body: 'We moved back to Pittsburgh after ten years in Chicago. Coffee, anyone?', createdAt: ago(8), ...S },
      { institutionId, memberId: o(27), kind: 'achievement', body: 'My first book, on small-business finance, comes out in the spring.', createdAt: ago(12), ...S },
      { institutionId, memberId: featured, kind: 'career', body: 'Finished a data analytics certificate and looking for analyst roles in operations. Happy to compare notes.', createdAt: ago(1), ...S },
    ],
  })
  const circle = await db.jobSearchCircle.create({
    data: { institutionId, name: 'Fall circle: back to work', focus: 'Mid-career alumni after a layoff', facilitator: 'Dana Whitfield (career coach)', startsAt: new Date(now.getTime() + 9 * DAY), weeks: 6, meetingTime: 'Tuesdays 6:00 pm', meetingUrl: 'https://meet.example.com/fall-circle', capacity: 6, createdBy: 'demo-seed', ...S },
    select: { id: true },
  })
  await db.jobSearchCircleMember.createMany({ data: [o(28), o(29), o(30)].map((m, k) => ({ circleId: circle.id, memberId: m, goal: ['Three interviews by week 4', 'Decide between ops and analytics', 'Get back to a director role'][k], ...S })) })
  const fair = await db.collegeEvent.create({
    data: { institutionId, title: 'Virtual career fair', kind: 'career_fair', startsAt: new Date(Math.floor((now.getTime() + 20 * DAY) / DAY) * DAY + 17 * 3600_000), location: 'Online', createdBy: 'demo-seed', ...S },
    select: { id: true },
  })
  const booths = await Promise.all(
    [
      { employerName: a.employers[0] ?? 'Harbor Ridge Manufacturing', roles: 'Operations manager, plant controller, quality engineer', pitch: 'Three alumni lead our plants. We hire people who fix things.' },
      { employerName: a.employers[1] ?? 'Northgate Media', roles: 'Account executive, content strategist', pitch: 'Fast growth, real training, and a W&J alum runs sales.' },
      { employerName: a.employers[2] ?? 'Granite Arch Insurance', roles: 'Claims analyst, data analyst, underwriting trainee', pitch: 'Stable, remote-friendly roles with tuition support.' },
    ].map((b) => db.fairBooth.create({ data: { ...b, eventId: fair.id, meetingUrl: 'https://meet.example.com/booth', ...S }, select: { id: true } })),
  )
  await db.fairBoothVisit.createMany({
    data: [
      { boothId: booths[0].id, memberId: o(31), note: 'Ten years in plant operations; interested in the ops manager role.', shareDossier: true, ...S },
      { boothId: booths[2].id, memberId: o(32), note: 'Looking at data analyst roles after a certificate.', ...S },
    ],
  })
  const employerCo = a.employers[0] ?? 'Harbor Ridge Manufacturing'
  await db.alumniIntroRequest.create({
    data: { institutionId, requesterMemberId: featured, targetMemberId: o(33), companyName: employerCo, purpose: 'referral', note: 'I’m applying for the senior analyst role; would you be open to referring me?', referralJobUrl: 'https://jobs.example.com/senior-analyst', status: 'ACCEPTED', respondedAt: ago(1), ...S },
  }).catch(() => null)

  // The demo system: both demo colleges, counted side by side at /systems.
  const system = await db.institutionSystem.upsert({ where: { slug: DEMO_SYSTEM_SLUG }, create: { slug: DEMO_SYSTEM_SLUG, name: 'Demo college system', ...S }, update: {}, select: { id: true } })
  await db.institution.update({ where: { id: institutionId }, data: { systemId: system.id } })

  return { opportunities: created.length, listed: listed.length, groups: groups.length }
}
