import 'server-only'
import { prisma } from '@/lib/prisma'
import { loadEngagementSignals } from '@/lib/journey/engagement-data'
import { getParallelPaths } from '@/lib/job-reviews/data'
import { activePaths } from '@/lib/journey/paths'
import { effectiveJourney, effectiveStage, getJourney } from '@/lib/journey/journey'
import { reaskDue, reaskOptions, reaskStateOf, type ReaskOption } from '@/lib/journey/stalled-reask'

export type StalledReaskEval = { weeks: number; asks: number; options: ReaskOption[] }

const WEEK_MS = 7 * 86_400_000

// Read-only, like the other Home prompts: the card records "shown" itself once it paints (src/app/dashboard/reask-actions.ts),
// so a render that never reaches the member never uses up an ask. No model calls.
export async function evaluateStalledReask(candidateId: string, opts: { hasCoach: boolean; earlyCareer: boolean }): Promise<StalledReaskEval | null> {
  // One small read first: most members are not in an active search, or have asked us to stop, and cost nothing more.
  const p = await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { journey: true, journeyStage: true, currentJobStatus: true, journeyDetails: true } })
  if (!p) return null
  const j = effectiveJourney(p)
  if (!j || !getJourney(j).searching || effectiveStage(p) !== 'APPLYING') return null
  const state = reaskStateOf(p.journeyDetails)
  if (state.stop || state.asks >= 3) return null
  const s = await loadEngagementSignals(candidateId)
  if (s.stage !== 'APPLYING' || !s.journey) return null
  const now = new Date()
  const base = {
    journey: s.journey,
    stage: s.stage,
    weeksInStage: s.weeksInStage,
    casual: s.casual,
    interviews: s.interviews,
    offers: s.offers,
    journeyDetails: s.rawDetails,
    hasCoach: opts.hasCoach,
    pivotKnown: (s.pivot?.targets?.length ?? 0) > 0,
    activePaths: 0,
    earning: s.workingNow,
    senior: !opts.earlyCareer,
    now,
  }
  if (!reaskDue(base)) return null
  // An interview on the calendar counts too, as in the stalled-search card.
  const since = new Date(now.getTime() - Math.max(1, s.weeksInStage) * WEEK_MS)
  const [calendarInterviews, kinds] = await Promise.all([
    prisma.trackedCalendarEvent.count({ where: { candidateId, eventType: 'INTERVIEW', dismissedAt: null, startTime: { gte: since } } }),
    getParallelPaths(candidateId),
  ])
  if (calendarInterviews > 0) return null
  const paths = activePaths({ main: s.journey, journeyDetails: s.rawDetails, kinds, workingNow: s.workingNow, interimInterest: false })
  const earning = s.workingNow || (kinds ?? []).some((k) => ['CONTRACT_1099', 'FRACTIONAL', 'CONSULTING', 'PART_TIME'].includes(k))
  const ctx = { ...base, activePaths: paths.length, earning }
  const due = reaskDue(ctx)
  if (!due) return null
  return { weeks: due.weeks, asks: due.asks, options: reaskOptions(ctx) }
}
