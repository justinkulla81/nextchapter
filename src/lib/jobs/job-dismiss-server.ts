import 'server-only'
import { prisma } from '@/lib/prisma'
import { ghostRisk } from '@/lib/jobs/ghost-risk'
import { loadJobSocs } from '@/lib/jobs/search-breadth-server'
import { buildDismissRules, type ActivePreference, type DismissRules, type PreferenceAction, type PreferenceKind } from '@/lib/jobs/job-dismiss'

// Loads what the board learned from a member's dismissals (job-dismiss.ts), once per
// board load: their dismissed board jobs and active preferences (two small indexed
// reads), plus the board-wide member ghost flags (cached a few minutes).

const FLAG_TTL_MS = 5 * 60_000
let confirmedCache: { at: number; ids: Promise<Set<string>> } | null = null

/** Postings an admin confirmed as ghost jobs (/support/admin/job-flags): hidden for everyone. */
export function getConfirmedGhostIds(): Promise<Set<string>> {
  if (!confirmedCache || Date.now() - confirmedCache.at > FLAG_TTL_MS) {
    const ids = prisma.jobPostingFlag
      .findMany({ where: { adminDecision: 'confirmed_ghost' }, select: { postingId: true }, distinct: ['postingId'] })
      .then((rows) => new Set(rows.map((r) => r.postingId)))
      .catch((error) => {
        console.error('Confirmed ghost flags unavailable:', error)
        return new Set<string>()
      })
    confirmedCache = { at: Date.now(), ids }
  }
  return confirmedCache.ids
}

export async function loadActivePreferences(candidateId: string): Promise<ActivePreference[]> {
  const rows = await prisma.jobDismissPreference.findMany({
    where: { candidateId, undoneAt: null },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as PreferenceKind,
    value: r.value,
    label: r.label,
    count: r.count,
    action: r.action as PreferenceAction,
    askedAt: r.askedAt,
  }))
}

/** The member's dismiss rules, or null without a member. Board and every job email apply them. */
export async function loadDismissRules(candidateId: string | null, preferencesOverride?: ActivePreference[]): Promise<DismissRules | null> {
  if (!candidateId) return null
  const [preferences, dismissed, occupations, confirmed] = await Promise.all([
    // An earlier set of preferences (personalization/match-compute.ts: a member's board before a change).
    preferencesOverride ? Promise.resolve(preferencesOverride) : loadActivePreferences(candidateId),
    prisma.trackedJob.findMany({ where: { candidateId, source: 'job_board', dismissedAt: { not: null } }, select: { sourceId: true } }),
    loadJobSocs(),
    getConfirmedGhostIds(),
  ])
  return buildDismissRules({
    preferences,
    dismissedIds: dismissed.map((d) => d.sourceId),
    industryOf: (id) => occupations.industries.get(id),
    // A member's own ghost flag hides the job for them (it is a dismissal); for everyone else
    // only once an admin confirms it (ghost-risk.ts).
    flaggedGhost: confirmed.size === 0 ? undefined : (id) => ghostRisk({ priorClosedCount: 0, ageDays: 0, adminConfirmed: confirmed.has(id) }).level === 'likely',
  })
}
