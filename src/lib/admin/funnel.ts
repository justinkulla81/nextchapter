import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'

// Admin funnel: traffic -> email/journey -> registration -> onboarding -> résumé
// -> activation -> engagement -> Candidate+ -> hired.
//
// Two different populations, kept separate on purpose:
//  - Traffic stages count anonymous visitors (distinct IP, human user agents only, same
//    dedupe the Visitors report uses) and lead rows, by the date the event happened.
//  - Member stages are a COHORT: profiles created in the window, followed through every
//    later step to today. A step is "reached ever", so a member who signed up 3 days ago
//    has had less time to reach later steps than one from 30 days ago.
// The two are not one pipeline (visitors carry no id until they register), so the page
// shows them as two bands and says so.

export type FunnelWindowDays = 7 | 30 | 90

export interface FunnelStage {
  key: string
  label: string
  /** What counts as having reached this step, in plain words. */
  definition: string
  count: number
}

export interface FunnelData {
  windowDays: FunnelWindowDays
  since: Date
  traffic: FunnelStage[]
  members: FunnelStage[]
  leadsByKind: { kind: string; count: number }[]
  leadsBySource: { source: string; count: number }[]
  landing: { path: string; visitors: number; leadsSameSource: number }[]
}

const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)

function humanOnly(): Prisma.Sql {
  // Rows with no user agent are excluded, matching the Visitors report (unknown is not human).
  return Prisma.sql`"userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))`
}

async function countRaw(query: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(query)
  return Number(rows[0]?.n ?? 0)
}

export async function computeFunnel(windowDays: FunnelWindowDays): Promise<FunnelData> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const [visitors, multiPage, leadEmails, landingRows, leadKinds, leadSources] = await Promise.all([
    countRaw(Prisma.sql`
      SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
      WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "createdAt" >= ${since} AND ${humanOnly()}`),
    countRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM (
        SELECT "ip" FROM "HomepageVisitEvent"
        WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" IS NOT NULL
          AND "createdAt" >= ${since} AND ${humanOnly()}
        GROUP BY "ip" HAVING COUNT(DISTINCT "path") >= 2
      ) t`),
    countRaw(Prisma.sql`
      SELECT COUNT(DISTINCT LOWER("email"))::bigint AS n FROM "HomepageLead"
      WHERE "createdAt" >= ${since}`),
    prisma.$queryRaw<{ path: string; visitors: bigint }[]>(Prisma.sql`
      SELECT first_path AS path, COUNT(*)::bigint AS visitors FROM (
        SELECT DISTINCT ON ("ip") "ip", "path" AS first_path FROM "HomepageVisitEvent"
        WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" IS NOT NULL
          AND "createdAt" >= ${since} AND ${humanOnly()}
        ORDER BY "ip", "createdAt" ASC
      ) f GROUP BY first_path ORDER BY visitors DESC LIMIT 15`),
    prisma.homepageLead.groupBy({ by: ['kind'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.homepageLead.groupBy({ by: ['source'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ])

  // Member cohort: registered profiles created in the window. Anonymous (never registered)
  // profiles are counted as "started" only, so the registration drop-off is visible.
  const cohortWhere = { createdAt: { gte: since } }
  const registeredWhere = { ...cohortWhere, registrationCompletedAt: { not: null } }
  const [started, registered, onboarded, withResume, activated, engaged, plus, hired] = await Promise.all([
    prisma.candidateProfile.count({ where: cohortWhere }),
    prisma.candidateProfile.count({ where: registeredWhere }),
    prisma.candidateProfile.count({ where: { ...registeredWhere, introCommittedAt: { not: null } } }),
    prisma.candidateProfile.count({ where: { ...registeredWhere, introCommittedAt: { not: null }, resumes: { some: {} } } }),
    prisma.candidateProfile.count({
      where: {
        ...registeredWhere,
        introCommittedAt: { not: null },
        resumes: { some: {} },
        trackedJobs: { some: { OR: [{ savedAt: { not: null } }, { firstClickedAt: { not: null } }] } },
      },
    }),
    countRaw(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "CandidateProfile" p
      WHERE p."createdAt" >= ${since} AND p."registrationCompletedAt" IS NOT NULL AND p."introCommittedAt" IS NOT NULL
        AND (SELECT COUNT(*) FROM "CandidateVisitDay" v WHERE v."candidateId" = p."id") >= 3
        AND EXISTS (SELECT 1 FROM "Resume" r WHERE r."candidateId" = p."id")
        AND EXISTS (SELECT 1 FROM "TrackedJob" t WHERE t."candidateId" = p."id" AND (t."savedAt" IS NOT NULL OR t."firstClickedAt" IS NOT NULL))`),
    prisma.candidateProfile.count({
      where: {
        ...registeredWhere,
        candidatePlusUnlockedAt: { not: null },
        candidatePlusRevokedAt: null,
      },
    }),
    prisma.candidateProfile.count({ where: { ...registeredWhere, hireOutcomes: { some: {} } } }),
  ])

  const landing = landingRows.map((r) => ({
    path: r.path,
    visitors: Number(r.visitors),
    leadsSameSource: leadSources
      .filter((s) => s.source === leadSourceForPath(r.path))
      .reduce((n, s) => n + s._count._all, 0),
  }))

  return {
    windowDays,
    since,
    traffic: [
      { key: 'visitors', label: 'Visitors', definition: 'Distinct people (by IP) with a human page view', count: visitors },
      { key: 'multiPage', label: 'Looked at 2+ pages', definition: 'Same visitors who viewed at least two different pages', count: multiPage },
      { key: 'lead', label: 'Gave email or journey', definition: 'Distinct emails left on a journey or saved-search box', count: leadEmails },
    ],
    members: [
      { key: 'started', label: 'Started an account', definition: 'Profiles created in the window (includes anonymous)', count: started },
      { key: 'registered', label: 'Registered', definition: 'Finished creating a permanent account', count: registered },
      { key: 'onboarded', label: 'Onboarded', definition: 'Finished the welcome page and committed', count: onboarded },
      { key: 'resume', label: 'Gave a résumé', definition: 'Onboarded and uploaded at least one résumé', count: withResume },
      { key: 'activated', label: 'Activated', definition: 'Onboarded, résumé in, and saved or opened at least one job', count: activated },
      { key: 'engaged', label: 'Engaged', definition: 'Activated and came back on 3 or more different days', count: engaged },
      { key: 'plus', label: 'Candidate+', definition: 'Unlocked Candidate+ and not revoked (any route, not only engaged members)', count: plus },
      { key: 'hired', label: 'Got a job', definition: 'Reported a hire outcome', count: hired },
    ],
    leadsByKind: leadKinds.map((k) => ({ kind: k.kind, count: k._count._all })).sort((a, b) => b.count - a.count),
    leadsBySource: leadSources
      .map((s) => ({ source: s.source, count: s._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    landing,
  }
}

// HomepageLead.source is 'home' | 'jobs' | 'start' | 'network:<type>:<slug>'. Only the three
// plain pages map cleanly to a landing path; everything else reports 0 here and is read from
// the lead-source table instead.
function leadSourceForPath(path: string): string | null {
  if (path === '/') return 'home'
  if (path === '/jobs') return 'jobs'
  if (path === '/start') return 'start'
  return null
}
