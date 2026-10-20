import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { loadActivePreferences } from '@/lib/jobs/job-dismiss-server'
import { memberBreadthVector } from '@/lib/jobs/search-breadth-server'
import { matchInputsOf, parseMatchInputs, sameMatchInputs, type MatchInputs } from '@/lib/personalization/match-inputs'
import type { MatchProfile } from '@/lib/personalization/match-compute'

// MemberMatchSnapshot reads and writes (prisma/manual/2026-10-16-match-snapshots.sql). Every
// write is best-effort: a failure here never fails the save or the page that called it.

/** What the member's matching reads right now: their profile fields, live dismiss preferences and occupation. */
export async function currentMatchInputs(profile: MatchProfile): Promise<MatchInputs> {
  const [prefs, vector] = await Promise.all([
    loadActivePreferences(profile.id).catch(() => []),
    memberBreadthVector(profile).catch(() => null),
  ])
  return matchInputsOf(profile as unknown as Record<string, unknown>, prefs, vector?.soc ?? null)
}

/**
 * The same, cheaply, for a save in progress (no classifier load on a cold server): the
 * occupation is the one saved for their current title, when it was read from a title; null
 * (resolve it again) otherwise.
 */
async function savedMatchInputs(profile: MatchProfile): Promise<MatchInputs> {
  const [prefs, occ] = await Promise.all([
    loadActivePreferences(profile.id).catch(() => []),
    prisma.candidateOccupation.findUnique({ where: { candidateId: profile.id }, select: { socCode: true, source: true, matchedFrom: true } }).catch(() => null),
  ])
  const title = profile.resumeLatestJobTitle?.trim() ?? ''
  const soc = occ && occ.source !== 'FUNCTION_PROXY' && title && occ.matchedFrom === title ? occ.socCode : null
  return matchInputsOf(profile as unknown as Record<string, unknown>, prefs, soc)
}

/**
 * Called by every save that changes matching, just before it writes: keeps the inputs the
 * member had, so the retune right after can show "before → after" on today's jobs. Skipped
 * when the latest snapshot already holds these inputs.
 */
export async function captureMatchBaseline(profile: MatchProfile): Promise<void> {
  try {
    const [inputs, latest] = await Promise.all([
      savedMatchInputs(profile),
      prisma.memberMatchSnapshot.findFirst({ where: { candidateId: profile.id, kind: { in: ['baseline', 'retune'] } }, orderBy: { createdAt: 'desc' }, select: { inputs: true } }),
    ])
    const prev = latest ? parseMatchInputs(latest.inputs) : null
    if (prev && sameMatchInputs(prev, inputs)) return
    await prisma.memberMatchSnapshot.create({ data: { candidateId: profile.id, kind: 'baseline', inputs: inputs as unknown as Prisma.InputJsonValue } })
  } catch (error) {
    console.error('Match baseline not saved:', error)
  }
}

/**
 * The member's matching before their last change, within 30 days: the latest inputs on file
 * that differ from these. A retune already recorded with these same inputs comes first — then
 * nothing changed since, and "before" is the same as now (no reasons to tell).
 */
export async function previousMatchInputs(candidateId: string, now: MatchInputs): Promise<{ inputs: MatchInputs; at: Date; unchanged: boolean } | null> {
  const rows = await prisma.memberMatchSnapshot.findMany({
    where: { candidateId, kind: { in: ['baseline', 'retune'] }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { inputs: true, createdAt: true, kind: true },
  })
  for (const r of rows) {
    const inputs = parseMatchInputs(r.inputs)
    if (!inputs) continue
    const same = sameMatchInputs(inputs, now)
    if (same && r.kind === 'retune') return { inputs, at: r.createdAt, unchanged: true }
    if (!same) return { inputs, at: r.createdAt, unchanged: false }
  }
  return null
}

export async function recordMatchSnapshot(input: {
  candidateId: string
  kind: 'retune' | 'daily'
  trigger?: string | null
  inputs: MatchInputs
  state: { counts: { checked: number | null; matches: number; strong: number | null }; ms: number | null }
  detail?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.memberMatchSnapshot.create({
      data: {
        candidateId: input.candidateId,
        kind: input.kind,
        trigger: input.trigger ?? null,
        inputs: input.inputs as unknown as Prisma.InputJsonValue,
        checked: input.state.counts.checked,
        relevant: input.state.counts.matches,
        strong: input.state.counts.strong,
        ms: input.state.ms,
        detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (error) {
    console.error('Match snapshot not saved:', error)
  }
}

export interface SnapshotRow {
  kind: string
  trigger: string | null
  relevant: number | null
  strong: number | null
  createdAt: Date
  detail: Prisma.JsonValue | null
}

/** Snapshots with counts since a date, newest first. */
export async function countedSnapshotsSince(candidateId: string, since: Date): Promise<SnapshotRow[]> {
  return prisma.memberMatchSnapshot
    .findMany({
      where: { candidateId, createdAt: { gte: since }, relevant: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { kind: true, trigger: true, relevant: true, strong: true, createdAt: true, detail: true },
    })
    .catch(() => [])
}

/** captureMatchBaseline for a save that only has the member's id. */
export async function captureMatchBaselineFor(candidateId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId } }).catch(() => null)
  if (profile) await captureMatchBaseline(profile)
}
