import 'server-only'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers, getAuthEmail } from '@/lib/admin/auth-users'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import type { Grade } from '@/lib/scoring/grade'

export interface RecruiterDatabaseRow {
  id: string
  name: string
  email: string
  primaryFunction: string
  level: string
  targetRoleType: string
  industry: string
  geo: string
  geoFlex: string
  privacyTier: string
  resumeScore: number | null
  execDossierGrade: Grade | null
  onSprintTarget: boolean
  recruiterDatabaseOptIn: boolean
  recruiterNotifiedAt: Date | null
  recruiterUnlockNudgedAt: Date | null
}

function formatGeo(city: string | null, state: string | null, country: string): string {
  return [city, state, country === 'US' ? null : country].filter(Boolean).join(', ') || '—'
}

// Every candidate with at least one grade snapshot — deliberately not
// filtered to recruiterDatabaseOptIn: true at the query level, since two of
// the four admin buckets below are specifically about A/B-grade candidates
// who HAVEN'T opted in yet (the whole point is surfacing them for a nudge).
export async function getRecruiterDatabaseRows(): Promise<RecruiterDatabaseRow[]> {
  const [candidates, authUsers] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { hireabilityReports: { some: {} } },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        primaryFunction: true,
        highestLevelReached: true,
        targetRoleType: true,
        industryContext: true,
        currentCity: true,
        currentState: true,
        currentCountry: true,
        remotePreference: true,
        openToRelocation: true,
        privacyTier: true,
        recruiterDatabaseOptIn: true,
        recruiterNotifiedAt: true,
        recruiterUnlockNudgedAt: true,
        hireabilityReports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: { hireabilityGradeAtGeneration: true },
        },
        resumes: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
          select: { atsScore: true },
        },
        weeklyBadgesEarned: {
          where: { badgeKey: 'WEEKLY_SPRINT_TARGET_HIT' },
          orderBy: { weekStartDate: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    }),
    listAllAuthUsers(),
  ])

  return candidates.map((c) => {
    const grade = normalizeGradeSnapshot(c.hireabilityReports[0]?.hireabilityGradeAtGeneration)
    const geoFlex = [c.remotePreference ? c.remotePreference : null, c.openToRelocation ? 'open to relocation' : null]
      .filter(Boolean)
      .join(' · ')
    return {
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed',
      email: getAuthEmail(authUsers, c.userId),
      primaryFunction: c.primaryFunction ?? '—',
      level: c.highestLevelReached ?? '—',
      targetRoleType: c.targetRoleType ?? '—',
      industry: c.industryContext ?? '—',
      geo: formatGeo(c.currentCity, c.currentState, c.currentCountry),
      geoFlex: geoFlex || '—',
      privacyTier: c.privacyTier,
      resumeScore: c.resumes[0]?.atsScore ?? null,
      execDossierGrade: grade?.grade ?? null,
      onSprintTarget: c.weeklyBadgesEarned.length > 0,
      recruiterDatabaseOptIn: c.recruiterDatabaseOptIn,
      recruiterNotifiedAt: c.recruiterNotifiedAt,
      recruiterUnlockNudgedAt: c.recruiterUnlockNudgedAt,
    }
  })
}

export interface RecruiterDatabaseBuckets {
  notified: RecruiterDatabaseRow[] // unlocked, A-grade, recruiters already told
  pendingNotify: RecruiterDatabaseRow[] // unlocked, A-grade, recruiters not yet told
  lockedAGrade: RecruiterDatabaseRow[] // A-grade but hasn't opted in
  almostThere: RecruiterDatabaseRow[] // B-grade, hasn't opted in — one step away
}

export function bucketRecruiterDatabaseRows(rows: RecruiterDatabaseRow[]): RecruiterDatabaseBuckets {
  const buckets: RecruiterDatabaseBuckets = { notified: [], pendingNotify: [], lockedAGrade: [], almostThere: [] }
  for (const row of rows) {
    if (row.recruiterDatabaseOptIn && row.execDossierGrade === 'A') {
      if (row.recruiterNotifiedAt) buckets.notified.push(row)
      else buckets.pendingNotify.push(row)
    } else if (!row.recruiterDatabaseOptIn && row.execDossierGrade === 'A') {
      buckets.lockedAGrade.push(row)
    } else if (!row.recruiterDatabaseOptIn && row.execDossierGrade === 'B') {
      buckets.almostThere.push(row)
    }
  }
  return buckets
}
