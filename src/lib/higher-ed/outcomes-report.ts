// The college's public Career Outcomes report, outcomes by major, and the
// trustee dashboard. Counts only. Anything under MIN_CELL_SIZE is withheld,
// employers and titles come only from alumni who share their outcome, and
// the giving lift appears only when the ROI rules allow it (both groups 30+).

import 'server-only'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { roiReport } from './roi'
import { peerBenchmark } from './peers'
import { donorReport } from './fund'

const DAY = 86_400_000
const atLeast = (n: number) => (n >= MIN_CELL_SIZE ? n : null)

export type OutcomesReport = {
  year: number
  from: Date
  to: Date
  members: number
  joined: number | null
  landed: number | null // outcome reports in the year
  medianDaysToLand: number | null
  helpedShare: number | null // of those who answered "Did the college help?"
  promotions: number | null
  topEmployers: { employer: string; n: number }[] // each at least MIN_CELL_SIZE... see below
  programsCompleted: number | null
  mentorCalls: number | null
  liftPoints: number | null
  peers: Awaited<ReturnType<typeof peerBenchmark>>
}

// The calendar year ending at `now` (rolling 12 months), so a report is
// never empty in January.
export async function outcomesReport(institutionId: string, now = new Date()): Promise<OutcomesReport> {
  const from = new Date(now.getTime() - 365 * DAY)
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { name: true, profile: true } })
  const [members, joined, reports, flags, programsCompleted, mentorCalls, roi, peers] = await Promise.all([
    prisma.institutionMember.count({ where: { institutionId, affiliation: { in: ['ALUM', 'STAFF_ALUM'] } } }),
    prisma.institutionMember.count({ where: { institutionId, status: { in: ['CLAIMED', 'ACTIVE'] } } }),
    prisma.outcomeReport.findMany({ where: { member: { institutionId }, reportedAt: { gte: from, lte: now } }, select: { memberId: true, helpedByInstitution: true } }),
    prisma.transitionFlag.findMany({ where: { member: { institutionId }, placedAt: { gte: from, lte: now } }, select: { startedAt: true, placedAt: true } }),
    prisma.enrollment.count({ where: { cohort: { program: { institutionId } }, completedAt: { gte: from, lte: now } } }),
    prisma.engagementEvent.count({ where: { institutionId, type: 'MENTOR_CALL', occurredAt: { gte: from, lte: now }, caseCategory: 'VOLUNTEER' } }),
    roiReport(institutionId, now),
    peerBenchmark(inst),
  ])
  const days = flags.map((f) => (f.placedAt!.getTime() - f.startedAt.getTime()) / DAY).sort((a, b) => a - b)
  const median = days.length >= MIN_CELL_SIZE ? Math.round(days[Math.floor(days.length / 2)]) : null
  const answered = reports.filter((r) => r.helpedByInstitution !== null)
  // Employers where at least MIN_CELL_SIZE alumni who share their outcome
  // landed this year: no single person is identifiable.
  const employers = await prisma.$queryRaw<{ employer: string; n: number }[]>`
    select d.employer, count(distinct o."memberId")::int as n
    from public."OutcomeReport" o join private.v_member_directory d on d."memberId" = o."memberId"
    where d."institutionId" = ${institutionId} and d."shareOutcome" and d.employer is not null and o."reportedAt" >= ${from} and o."reportedAt" <= ${now}
    group by d.employer having count(distinct o."memberId") >= ${MIN_CELL_SIZE} order by n desc limit 10`
  const promotions = await prisma.prospectFlag.count({ where: { institutionId, type: 'PROMOTION_VP_PLUS', detectedAt: { gte: from, lte: now } } })
  return {
    year: now.getUTCFullYear(),
    from,
    to: now,
    members,
    joined: atLeast(joined),
    landed: atLeast(new Set(reports.map((r) => r.memberId)).size),
    medianDaysToLand: median,
    helpedShare: answered.length >= MIN_CELL_SIZE ? answered.filter((r) => r.helpedByInstitution).length / answered.length : null,
    promotions: atLeast(promotions),
    topEmployers: employers,
    programsCompleted: atLeast(programsCompleted),
    mentorCalls: atLeast(mentorCalls),
    liftPoints: roi.roi.lift,
    peers,
  }
}

export type MajorOutcome = { major: string; alumni: number; employers: { employer: string; n: number }[]; titles: { title: string; n: number }[] }

// "What W&J economics grads do": per major with enough alumni, the employers
// and titles at least two of them share (roster employer, or the NextChapter
// one for alumni who share it). A major with fewer than MIN_CELL_SIZE alumni
// on the roster isn't shown at all.
export async function outcomesByMajor(institutionId: string, onlyMajor?: string): Promise<MajorOutcome[]> {
  const rows = await prisma.$queryRaw<{ major: string; employer: string | null; title: string | null }[]>`
    select m.major, coalesce(d.employer, m."lastKnownEmployer") as employer, coalesce(d.title, m."lastKnownTitle") as title
    from public."InstitutionMember" m left join private.v_member_directory d on d."memberId" = m.id
    where m."institutionId" = ${institutionId} and m.major is not null and m.affiliation in ('ALUM', 'STAFF_ALUM')`
  const by = new Map<string, typeof rows>()
  for (const r of rows) if (!onlyMajor || r.major === onlyMajor) by.set(r.major, [...(by.get(r.major) ?? []), r])
  const count = (xs: (string | null)[]) => {
    const m = new Map<string, number>()
    for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1)
    return [...m.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }
  return [...by.entries()]
    .filter(([, xs]) => xs.length >= MIN_CELL_SIZE)
    .map(([major, xs]) => ({
      major,
      alumni: xs.length,
      employers: count(xs.map((x) => x.employer)).map(([employer, n]) => ({ employer, n })),
      titles: count(xs.map((x) => x.title)).map(([title, n]) => ({ title, n })),
    }))
    .sort((a, b) => b.alumni - a.alumni)
}

// One page for the president and trustees.
export async function boardDashboard(institutionId: string, now = new Date()) {
  const [report, roi, fund, transition, events] = await Promise.all([
    outcomesReport(institutionId, now),
    roiReport(institutionId, now),
    donorReport(institutionId),
    prisma.transitionFlag.count({ where: { member: { institutionId }, state: 'IN_TRANSITION' } }),
    prisma.eventRsvp.count({ where: { event: { institutionId }, checkedInAt: { gte: new Date(now.getTime() - 365 * DAY) } } }),
  ])
  const joined = await prisma.institutionMember.count({ where: { institutionId, status: { in: ['CLAIMED', 'ACTIVE'] } } })
  return { report, roi: roi.roi, fy: roi.fy, fund, inTransition: transition, eventAttendance: events, participation: report.members ? joined / report.members : null, joined }
}
