import 'server-only'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE, suppressSmallCells, type MaybeSuppressed } from '@/lib/admin/cell-suppression'

// NextChapter RESEARCH: how members fare, grouped by where they studied, degree level,
// seniority, function and industry.
//
// What this is not, and the page says so:
//   - It is NOT an unemployment rate. People join NextChapter because they are in a
//     search; a group's "share between jobs" describes who joined, not a population.
//   - It is NOT a measure of anyone's character. It reports observable, aggregate
//     behaviour — logging in, applying, doing outreach, landing interviews — and never
//     labels a person or a group's "work ethic".
//
// Admin-only (enforced by src/test/company-wall.test.ts: nothing a member, recruiter,
// coach or hiring manager can reach imports this), aggregate-only, and any group under
// MIT_CELL_SIZE members is suppressed before it leaves this function. Members in
// Confidential Search Mode are excluded entirely.

const DAY_MS = 24 * 60 * 60 * 1000

export type Dimension = 'school' | 'degreeLevel' | 'level' | 'function' | 'industry'

export interface OutcomeGroup {
  group: string
  members: number
  /** Share of members who have applied to at least one job. */
  appliedPct: number
  /** Of those who applied: share who landed at least one interview. */
  interviewPct: number | null
  /** Share with a status of laid off or resigned (self-reported). Not an unemployment rate. */
  betweenJobsPct: number
  /** Share active (a login) in the last 30 days. */
  activePct: number
  /** Share who logged outreach in the last 30 days. */
  outreachPct: number
}

interface MemberRow {
  id: string
  schools: string[]
  degreeLevels: string[]
  level: string | null
  fn: string | null
  industry: string | null
  status: string | null
  applied: boolean
  interviewed: boolean
  active30: boolean
  outreach30: boolean
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((100 * n) / d))

export function summarize(rows: MemberRow[], keyOf: (r: MemberRow) => string[]): OutcomeGroup[] {
  const byGroup = new Map<string, MemberRow[]>()
  for (const r of rows) {
    for (const k of new Set(keyOf(r).filter(Boolean))) {
      const list = byGroup.get(k)
      if (list) list.push(r)
      else byGroup.set(k, [r])
    }
  }
  return [...byGroup.entries()]
    .map(([group, ms]) => {
      const applied = ms.filter((m) => m.applied)
      return {
        group,
        members: ms.length,
        appliedPct: pct(applied.length, ms.length),
        interviewPct: applied.length > 0 ? pct(applied.filter((m) => m.interviewed).length, applied.length) : null,
        betweenJobsPct: pct(ms.filter((m) => m.status === 'LAID_OFF' || m.status === 'RESIGNED').length, ms.length),
        activePct: pct(ms.filter((m) => m.active30).length, ms.length),
        outreachPct: pct(ms.filter((m) => m.outreach30).length, ms.length),
      }
    })
    .sort((a, b) => b.members - a.members)
}

export interface EducationOutcomes {
  members: number
  generatedAt: Date
  byDimension: Record<Dimension, MaybeSuppressed<OutcomeGroup>[]>
}

export async function loadEducationOutcomes(): Promise<EducationOutcomes> {
  const since = new Date(Date.now() - 30 * DAY_MS)
  const members = await prisma.candidateProfile.findMany({
    where: { isSystemAccount: false, isSampleData: false, confidentialSearchMode: false },
    select: {
      id: true,
      highestLevelReached: true,
      primaryFunction: true,
      industryBucket: true,
      currentJobStatus: true,
      educationHistory: { select: { degreeLevel: true, school: { select: { name: true } } } },
    },
  })
  const ids = members.map((m) => m.id)

  const [applications, logins, outreach] = await Promise.all([
    prisma.jobPosting.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: ids }, appliedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.candidateLoginEvent.findMany({
      where: { candidateId: { in: ids }, createdAt: { gte: since } },
      select: { candidateId: true },
      distinct: ['candidateId'],
    }),
    prisma.outreachLog.findMany({
      where: { candidateId: { in: ids }, loggedAt: { gte: since } },
      select: { candidateId: true },
      distinct: ['candidateId'],
    }),
  ])
  const interviews = await prisma.jobPosting.findMany({
    where: { candidateId: { in: ids }, OR: [{ interviewLandedAt: { not: null } }, { offerReceivedAt: { not: null } }] },
    select: { candidateId: true },
    distinct: ['candidateId'],
  })
  const applied = new Set(applications.map((a) => a.candidateId))
  const interviewed = new Set(interviews.map((i) => i.candidateId))
  const active = new Set(logins.map((l) => l.candidateId))
  const reached = new Set(outreach.map((o) => o.candidateId))

  const rows: MemberRow[] = members.map((m) => ({
    id: m.id,
    schools: m.educationHistory.map((e) => e.school?.name).filter((n): n is string => !!n),
    degreeLevels: m.educationHistory.map((e) => e.degreeLevel).filter((n): n is string => !!n),
    level: m.highestLevelReached,
    fn: m.primaryFunction,
    industry: m.industryBucket,
    status: m.currentJobStatus,
    applied: applied.has(m.id),
    interviewed: interviewed.has(m.id),
    active30: active.has(m.id),
    outreach30: reached.has(m.id),
  }))

  const dims: Record<Dimension, (r: MemberRow) => string[]> = {
    school: (r) => r.schools,
    degreeLevel: (r) => r.degreeLevels,
    level: (r) => (r.level ? [r.level] : []),
    function: (r) => (r.fn ? [r.fn] : []),
    industry: (r) => (r.industry ? [r.industry] : []),
  }
  const byDimension = Object.fromEntries(
    (Object.keys(dims) as Dimension[]).map((d) => [
      d,
      suppressSmallCells(summarize(rows, dims[d]), (g) => g.members, (g) => g.group, MIN_CELL_SIZE),
    ])
  ) as EducationOutcomes['byDimension']

  return { members: rows.length, generatedAt: new Date(), byDimension }
}
