import 'server-only'
import type { CandidatePlatformActivity, InterimListing } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPlatform, platformsForSenderDomain, PLATFORM_CATEGORY_LABEL, type PlatformKind } from './directory'
import { STAGE_LABEL, type PlatformStageKey } from './stages'

export type PlatformTone = 'progress' | 'done' | 'warning' | 'muted'

export interface PlatformStatus {
  label: string
  tone: PlatformTone
  // "Gone quiet", "Not accepted", "Falling behind" — shown next to the stage.
  healthLabel: string | null
}

export interface PlatformActivityRow extends PlatformStatus {
  platformKey: string
  name: string
  category: string
  kind: PlatformKind
  stage: PlatformStageKey
  stageAt: Date
  lastEmailAt: Date
  lastSubject: string | null
  courseTitle: string | null
  dismissed: boolean
}

const DAY = 24 * 60 * 60 * 1000
// No progress email for this long after starting → gone quiet. Work
// platforms go longer between projects than a course goes between weeks.
const QUIET_AFTER_DAYS: Record<PlatformKind, number> = { WORK: 30, LEARNING: 21 }

/** Stage pill text, tone and any health warning — computed at read time. */
export function platformStatus(row: Pick<CandidatePlatformActivity, 'kind' | 'stage' | 'health' | 'lastProgressAt' | 'firstSeenAt'>, now: Date): PlatformStatus {
  const stage = row.stage as PlatformStageKey
  const label = STAGE_LABEL[stage]
  const finished = stage === 'COMPLETED'
  let healthLabel: string | null = null
  if (row.health === 'NOT_ACCEPTED') healthLabel = 'Not accepted'
  else if (row.health === 'FALLING_BEHIND' && !finished) healthLabel = 'Falling behind'
  else if (!finished) {
    const startedWork = row.kind === 'WORK' ? ['ACCEPTED', 'WORKING', 'EARNING'].includes(stage) : ['ENROLLED', 'LEARNING', 'EXAM_BOOKED'].includes(stage)
    const last = row.lastProgressAt ?? row.firstSeenAt
    if (row.health === 'GONE_QUIET' || (startedWork && now.getTime() - last.getTime() > QUIET_AFTER_DAYS[row.kind] * DAY)) {
      healthLabel = 'Gone quiet'
    }
  }
  const tone: PlatformTone = healthLabel ? 'warning' : finished || stage === 'EARNING' ? 'done' : stage === 'SIGNED_UP' ? 'muted' : 'progress'
  return { label, tone, healthLabel }
}

export async function getPlatformActivity(candidateId: string, kind?: PlatformKind): Promise<PlatformActivityRow[]> {
  const rows = await prisma.candidatePlatformActivity.findMany({
    where: { candidateId, ...(kind ? { kind } : {}) },
    orderBy: [{ dismissedAt: { sort: 'desc', nulls: 'first' } }, { lastEmailAt: 'desc' }],
  })
  const now = new Date()
  return rows.flatMap((r) => {
    const platform = getPlatform(r.platformKey)
    if (!platform) return []
    return [{
      ...platformStatus(r, now),
      platformKey: r.platformKey,
      name: platform.name,
      category: PLATFORM_CATEGORY_LABEL[platform.category],
      kind: platform.kind,
      stage: r.stage as PlatformStageKey,
      stageAt: r.stageAt,
      lastEmailAt: r.lastEmailAt,
      lastSubject: r.lastSubject,
      courseTitle: r.courseTitle,
      dismissed: !!r.dismissedAt,
    }]
  })
}

/** listingId → status, for the stage pill on each Interim Work listing card. */
export function statusByListing(listings: Pick<InterimListing, 'id' | 'url'>[], rows: PlatformActivityRow[]): Map<string, PlatformStatus> {
  const byKey = new Map(rows.filter((r) => !r.dismissed).map((r) => [r.platformKey, r]))
  const out = new Map<string, PlatformStatus>()
  for (const listing of listings) {
    let host: string
    try {
      host = new URL(listing.url).hostname
    } catch {
      continue
    }
    const row = platformsForSenderDomain(host).map((p) => byKey.get(p.key)).find(Boolean)
    if (row) out.set(listing.id, { label: row.label, tone: row.tone, healthLabel: row.healthLabel })
  }
  return out
}
