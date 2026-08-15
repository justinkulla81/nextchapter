import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  readDimension,
  SESSION_DIMENSIONS,
  type DimensionReading,
  type SessionDimensionKey,
} from './session-dimensions'

export interface DimensionHistoryPoint extends DimensionReading {
  occurredAt: Date
}

// Recent sessions' readings for every dimension, oldest first — the input to
// the trend-line component (§A5.1: "each renders as a trend line") and to
// the pre-session brief's latest-snapshot summary. A dimension with no
// status AND no trend logged for a given session is dropped from that
// dimension's series entirely (that session genuinely didn't cover it),
// rather than rendered as a gap — a coach skipping a dimension on a given
// session is normal, not itself a signal.
export async function getDimensionHistory(
  candidateId: string,
  limit = 8
): Promise<Record<SessionDimensionKey, DimensionHistoryPoint[]>> {
  const sessions = await prisma.coachSession.findMany({
    where: { candidateId },
    orderBy: { occurredAt: 'desc' },
    take: limit,
  })
  const chronological = [...sessions].reverse()

  const history = {} as Record<SessionDimensionKey, DimensionHistoryPoint[]>
  for (const key of SESSION_DIMENSIONS) {
    history[key] = chronological
      .map((session) => ({ ...readDimension(session, key), occurredAt: session.occurredAt }))
      .filter((point) => point.status !== null || point.trend !== null)
  }
  return history
}

// The single most recent reading logged for each dimension (not necessarily
// all from the same session — a coach might track Targeting one session and
// Skills the next) — what the pre-session brief shows as "where things
// stand right now" and what feeds the §A5.1 intervention-suggestion rule.
export async function getLatestDimensionSnapshot(candidateId: string): Promise<DimensionReading[]> {
  const history = await getDimensionHistory(candidateId, 12)
  return SESSION_DIMENSIONS.map((key) => {
    const series = history[key]
    const latest = series[series.length - 1]
    return latest ? { key, status: latest.status, trend: latest.trend, note: latest.note } : { key, status: null, trend: null, note: null }
  })
}
