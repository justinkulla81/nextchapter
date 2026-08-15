import 'server-only'
import type { CoachRateCard, CoachSessionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { COACH_SESSION_TYPES } from '@/lib/constants/coach-session-type'

export { COACH_SESSION_TYPES, COACH_SESSION_TYPE_LABELS, COACH_RATE_CARD_DEFAULTS } from '@/lib/constants/coach-session-type'

// The single place a session's pay rate is decided. Checks a per-coach
// override first (coachId set), falls back to the default row for that
// sessionType (coachId null), and within each, picks the latest
// effectiveDate that has already arrived — never a future-dated row, and
// never a row from after `asOf`. Returns null only if no default rate has
// ever been seeded for this sessionType, which shouldn't happen once
// scripts/seed-commercial-config.ts has run.
export async function getApplicableRateCents(
  sessionType: CoachSessionType,
  coachId: string,
  asOf: Date = new Date()
): Promise<number | null> {
  const override = await prisma.coachRateCard.findFirst({
    where: { sessionType, coachId, effectiveDate: { lte: asOf } },
    orderBy: { effectiveDate: 'desc' },
    select: { rateCents: true },
  })
  if (override) return override.rateCents

  const defaultRow = await prisma.coachRateCard.findFirst({
    where: { sessionType, coachId: null, effectiveDate: { lte: asOf } },
    orderBy: { effectiveDate: 'desc' },
    select: { rateCents: true },
  })
  return defaultRow?.rateCents ?? null
}

export interface RateCardHistoryEntry extends CoachRateCard {
  coach: { fullName: string } | null
  isCurrent: boolean
}

// Full history (current + past) grouped by sessionType, for the admin list
// view — defaults (coachId null) and per-coach overrides shown separately.
// "Current" is computed relative to now, per row's own (sessionType,
// coachId) group, so each group's most-recent already-effective row is
// flagged independently.
export async function getRateCardHistory(): Promise<Record<CoachSessionType, RateCardHistoryEntry[]>> {
  const rows = await prisma.coachRateCard.findMany({
    include: { coach: { select: { fullName: true } } },
    orderBy: [{ sessionType: 'asc' }, { coachId: 'asc' }, { effectiveDate: 'desc' }],
  })

  const now = new Date()
  const seenCurrent = new Set<string>() // key: sessionType|coachId

  const result = Object.fromEntries(COACH_SESSION_TYPES.map((t) => [t, [] as RateCardHistoryEntry[]])) as Record<
    CoachSessionType,
    RateCardHistoryEntry[]
  >

  for (const row of rows) {
    const key = `${row.sessionType}|${row.coachId ?? 'default'}`
    const alreadyEffective = row.effectiveDate <= now
    const isCurrent = alreadyEffective && !seenCurrent.has(key)
    if (isCurrent) seenCurrent.add(key)
    result[row.sessionType].push({ ...row, isCurrent })
  }

  return result
}

export async function createRateCardEntry(input: {
  sessionType: CoachSessionType
  rateCents: number
  effectiveDate: Date
  coachId: string | null
  createdBy: string
}): Promise<CoachRateCard> {
  return prisma.coachRateCard.create({ data: input })
}
