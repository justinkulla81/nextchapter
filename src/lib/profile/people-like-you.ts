import 'server-only'
import { prisma } from '@/lib/prisma'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { roleForTitle, ROLES } from '@/lib/pivots/pivot-map'
import { WORK_DIMS, workProfile, type WorkProfile } from './work-profile'

// "People who work like you": others whose ten-dimension work profile is
// close to yours, and what they do now. Counts only, never names; nothing
// under MIN_CELL_SIZE is shown. Used for college alumni (their consented
// titles) and NextChapter-wide on Pivot paths (members' current roles).

const SIMILAR_AT = 0.75 // 1 = identical on every shared dimension
const MIN_SHARED_DIMS = 3

export function workSimilarity(a: WorkProfile, b: WorkProfile): number | null {
  let sum = 0
  let n = 0
  for (const d of WORK_DIMS) {
    const x = a[d.key]
    const y = b[d.key]
    if (!x || !y || x.confidence < 0.3 || y.confidence < 0.3) continue
    sum += Math.abs(x.value - y.value) / 2
    n++
  }
  return n >= MIN_SHARED_DIMS ? 1 - sum / n : null
}

// Work profiles for many people in a handful of queries (no per-person reads).
export async function loadWorkProfiles(candidateIds: string[]): Promise<Map<string, WorkProfile>> {
  if (!candidateIds.length) return new Map()
  const safe = async <T,>(p: Promise<T>, empty: T): Promise<T> => p.catch(() => empty)
  const [profiles, assessments, needs, tracks, prefs] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, workStyleAnswers: true, remotePreference: true, creativityConfidence: true, managementSkillConfidence: true, isPeopleManager: true, equityImportant: true, priorityJobSecurity: true, priorityMaxComp: true, priorityWorkLife: true },
    }),
    safe(prisma.candidateAssessmentResponse.findMany({ where: { candidateId: { in: candidateIds } }, orderBy: { completedAt: 'desc' }, select: { candidateId: true, dimensionVectors: true } }), []),
    safe(prisma.whatINeedResponse.findMany({ where: { candidateId: { in: candidateIds } }, select: { candidateId: true, itemRatings: true } }), []),
    safe(prisma.trackRecordResponse.findMany({ where: { candidateId: { in: candidateIds } }, select: { candidateId: true, largestTeamManaged: true, droveOutcomesThroughOthers: true } }), []),
    safe(prisma.pivotPreference.findMany({ where: { candidateId: { in: candidateIds } }, select: { candidateId: true, peopleEnergy: true } }), []),
  ])
  const vec = new Map<string, Record<string, number>>()
  for (const a of assessments) {
    if (vec.has(a.candidateId)) continue // latest first
    const raw = (a.dimensionVectors ?? {}) as Record<string, unknown>
    vec.set(a.candidateId, Object.fromEntries(Object.entries(raw).filter(([, x]) => typeof x === 'number').map(([k, x]) => [k, Math.abs(x as number) > 1 ? (x as number) / 2 : (x as number)])))
  }
  const need = new Map(needs.map((n) => [n.candidateId, Array.isArray(n.itemRatings) ? Object.fromEntries((n.itemRatings as { itemId: string; rating: number }[]).map((r) => [r.itemId, r.rating])) : null]))
  const track = new Map(tracks.map((t) => [t.candidateId, t]))
  const energy = new Map(prefs.map((p) => [p.candidateId, p.peopleEnergy]))
  return new Map(
    profiles.map((p) => {
      const e = energy.get(p.id)
      const t = track.get(p.id)
      return [
        p.id,
        workProfile({
          ...p,
          vectors: vec.get(p.id) ?? null,
          needs: need.get(p.id) ?? null,
          peopleEnergy: e === 'HIGH' || e === 'SOME' || e === 'LOW' ? e : null,
          largestTeamManaged: t?.largestTeamManaged ?? null,
          droveOutcomesThroughOthers: t?.droveOutcomesThroughOthers ?? null,
        }),
      ]
    }),
  )
}

export type WorkAlike = { similar: number; roles: { label: string; n: number }[]; titles: { label: string; n: number }[]; employers: { label: string; n: number }[] } | null

// Among `pool` (people with a current title, and an employer when they share
// it), the ones who work like `candidateId`, and where they are. Null when
// fewer than MIN_CELL_SIZE are alike, or we don't know enough about you.
export async function peopleWhoWorkLikeYou(candidateId: string, pool: { candidateId: string; title: string | null; employer: string | null }[]): Promise<WorkAlike> {
  const ids = [...new Set([candidateId, ...pool.map((p) => p.candidateId)])].slice(0, 2000)
  const profiles = await loadWorkProfiles(ids)
  const me = profiles.get(candidateId)
  if (!me) return null
  const alike = pool.filter((p) => p.candidateId !== candidateId).filter((p) => {
    const other = profiles.get(p.candidateId)
    const sim = other ? workSimilarity(me, other) : null
    return sim !== null && sim >= SIMILAR_AT
  })
  if (alike.length < MIN_CELL_SIZE) return null
  const top = (xs: (string | null)[]) => {
    const m = new Map<string, number>()
    for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1)
    return [...m.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, n]) => ({ label, n }))
  }
  return {
    similar: alike.length,
    roles: top(alike.map((p) => (p.title ? roleForTitle(p.title) : null)).map((k) => (k ? (ROLES.get(k)?.label ?? null) : null))),
    titles: top(alike.map((p) => p.title)),
    employers: top(alike.map((p) => p.employer)),
  }
}

// NextChapter-wide pool: members with a current title (no employers: those
// are private outside a college's consented directory).
export async function memberPool(limit = 2000) {
  const rows = await prisma.candidateProfile.findMany({ where: { isSampleData: false, resumeLatestJobTitle: { not: null } }, select: { id: true, resumeLatestJobTitle: true }, take: limit, orderBy: { updatedAt: 'desc' } })
  return rows.map((r) => ({ candidateId: r.id, title: r.resumeLatestJobTitle, employer: null }))
}
