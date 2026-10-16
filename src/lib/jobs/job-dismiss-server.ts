import 'server-only'
import { prisma } from '@/lib/prisma'
import { ghostRisk } from '@/lib/jobs/ghost-risk'
import { loadJobSocs } from '@/lib/jobs/search-breadth-server'
import { buildDismissRules, type ActivePreference, type DismissRules, type PreferenceAction, type PreferenceKind } from '@/lib/jobs/job-dismiss'

// Loads what the board learned from a member's dismissals (job-dismiss.ts), once per
// board load: their dismissed board jobs and active preferences (two small indexed
// reads), plus the board-wide member ghost flags (cached a few minutes).

const FLAG_TTL_MS = 5 * 60_000
let flagCache: { at: number; counts: Promise<Map<string, number>> } | null = null

/** Members who flagged each posting as a ghost job or too good to be true. */
export function getMemberGhostFlagCounts(): Promise<Map<string, number>> {
  if (!flagCache || Date.now() - flagCache.at > FLAG_TTL_MS) {
    const counts = prisma.jobPostingFlag
      .groupBy({ by: ['postingId'], where: { kind: { in: ['ghost', 'too_good'] } }, _count: { _all: true } })
      .then((rows) => new Map(rows.map((r) => [r.postingId, r._count._all])))
      .catch((error) => {
        console.error('Member ghost flags unavailable:', error)
        return new Map<string, number>()
      })
    flagCache = { at: Date.now(), counts }
  }
  return flagCache.counts
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
export async function loadDismissRules(candidateId: string | null): Promise<DismissRules | null> {
  if (!candidateId) return null
  const [preferences, dismissed, occupations, flags] = await Promise.all([
    loadActivePreferences(candidateId),
    prisma.trackedJob.findMany({ where: { candidateId, source: 'job_board', dismissedAt: { not: null } }, select: { sourceId: true } }),
    loadJobSocs(),
    getMemberGhostFlagCounts(),
  ])
  return buildDismissRules({
    preferences,
    dismissedIds: dismissed.map((d) => d.sourceId),
    industryOf: (id) => occupations.industries.get(id),
    // Member flags feed ghost risk: enough of them and the job is a likely ghost for everyone.
    flaggedGhost: flags.size === 0 ? undefined : (id) => ghostRisk({ priorClosedCount: 0, ageDays: 0, memberFlags: flags.get(id) ?? 0 }).level === 'likely',
  })
}
