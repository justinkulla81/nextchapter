import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeDossierCompleteness } from '@/lib/scoring/dossier-unlock'
import { getMondayOfWeek } from '@/lib/weekly/sprint'

// PART THREE §10-12 of docs/specs/NextChapter_Search_Visibility_References_
// Leaderboards.md — "Has anything changed?" Shown only to members in
// Confidential Search Mode, at most once every 30 days, never on a timer
// alone (§11).

export type PassiveToActiveTrigger =
  | 'DOSSIER_COMPLETE'
  | 'FIRST_APPLICATION_LOGGED'
  | 'WEEKLY_ACTIVITY_DOUBLED'
  | 'PERSONA_CHANGED_TO_LAID_OFF'
  | 'SIXTY_DAY_CHECKIN'

export interface PassiveToActivePromptEval {
  trigger: PassiveToActiveTrigger
}

const THROTTLE_DAYS = 30
const CHECKIN_DAYS = 60
const TRAILING_WEEKS = 4
const MS_PER_DAY = 24 * 60 * 60 * 1000

// §11 — sums the same four raw activity logs this session's earlier work
// (References/Leaderboards prep) established as the real per-candidate
// activity ledger: distinct-channel outreach, LinkedIn posts, Community
// posts, and logged applications. [from, to) half-open window.
async function countWeeklyActivity(candidateId: string, from: Date, to: Date): Promise<number> {
  const [outreach, linkedIn, posts, applications] = await Promise.all([
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: from, lt: to } } }),
    prisma.linkedInActivityLog.count({ where: { candidateId, loggedAt: { gte: from, lt: to } } }),
    prisma.communityPost.count({ where: { candidateId, createdAt: { gte: from, lt: to } } }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: from, lt: to } } }),
  ])
  return outreach + linkedIn + posts + applications
}

// "Weekly activity doubles versus their trailing average" — current
// Monday-Sunday week (member-local isn't tracked anywhere in this codebase
// for weekly boundaries yet, so this matches getMondayOfWeek's existing
// UTC-Monday convention, same as WeeklySprint) versus the average of the
// preceding TRAILING_WEEKS weeks. A trailing average of zero can't
// meaningfully "double" — that would trip on literally any first active
// week for a previously-idle or brand-new member, which isn't what
// "behavior changed" is supposed to mean, so it's excluded rather than
// treated as an always-true edge case.
async function isWeeklyActivityDoubled(candidateId: string): Promise<boolean> {
  const currentWeekStart = getMondayOfWeek(new Date())
  const trailingStart = new Date(currentWeekStart)
  trailingStart.setUTCDate(trailingStart.getUTCDate() - TRAILING_WEEKS * 7)

  const [currentWeekCount, trailingTotal] = await Promise.all([
    countWeeklyActivity(candidateId, currentWeekStart, new Date()),
    countWeeklyActivity(candidateId, trailingStart, currentWeekStart),
  ])

  const trailingAverage = trailingTotal / TRAILING_WEEKS
  if (trailingAverage <= 0) return false
  return currentWeekCount >= trailingAverage * 2
}

// Read-only — never writes. Mirrors getSentimentAlert's
// compute-a-boolean-on-dashboard-load contract (src/lib/daily/mood.ts),
// itself the existing precedent for "evaluate a condition and maybe show
// something on next dashboard load." Calling this repeatedly (React
// re-renders, prefetches) is always safe; the caller
// (recordPassiveToActivePromptShown in src/app/dashboard/actions.ts) is the
// only place that persists anything, and only once the prompt actually
// renders client-side.
export async function evaluatePassiveToActivePrompt(candidateId: string): Promise<PassiveToActivePromptEval | null> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      confidentialSearchMode: true,
      passiveToActivePromptDontAskAgain: true,
      passiveToActivePromptLastShownAt: true,
      confidentialModeEnteredJobStatus: true,
      currentJobStatus: true,
      registrationCompletedAt: true,
    },
  })

  // §10 — shown only to members in Confidential Search Mode.
  if (!profile.confidentialSearchMode) return null

  // §11 — "Don't ask again" is permanent, checked before every trigger
  // evaluation, real not just in copy.
  if (profile.passiveToActivePromptDontAskAgain) return null

  const now = Date.now()

  // §11 — "never more than once every 30 days."
  if (profile.passiveToActivePromptLastShownAt) {
    const daysSinceShown = (now - profile.passiveToActivePromptLastShownAt.getTime()) / MS_PER_DAY
    if (daysSinceShown < THROTTLE_DAYS) return null
  }

  const [dossier, firstApplicationCount, weeklyDoubled] = await Promise.all([
    computeDossierCompleteness(candidateId),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null } } }),
    isWeeklyActivityDoubled(candidateId),
  ])

  // Priority order matches the spec's table top-to-bottom: the more
  // specific, meaningful signals win over the low-frequency fallback when
  // more than one happens to be true at once (e.g. dossier just completed
  // AND it's also been 60 days) — reporting the specific one is more
  // useful for analytics than the generic check-in.
  if (dossier.isComplete) return { trigger: 'DOSSIER_COMPLETE' }
  if (firstApplicationCount > 0) return { trigger: 'FIRST_APPLICATION_LOGGED' }
  if (weeklyDoubled) return { trigger: 'WEEKLY_ACTIVITY_DOUBLED' }

  // "Persona changed from Worried to Laid off." confidentialModeEnteredJobStatus
  // is the accepted lossy "Worried" proxy (EMPLOYED_CONSIDERING_MOVE, same
  // mapping as defaultConfidentialSearchMode) snapshotted at the moment the
  // mode last turned on. Prompt only — never auto-switches the mode itself.
  if (profile.confidentialModeEnteredJobStatus === 'EMPLOYED_CONSIDERING_MOVE' && profile.currentJobStatus === 'LAID_OFF') {
    return { trigger: 'PERSONA_CHANGED_TO_LAID_OFF' }
  }

  // §11 — "60 days elapsed with no prompt shown." Reference point is the
  // last time it was shown, or (if it's never been shown at all)
  // registration — so a brand-new candidate isn't immediately eligible the
  // moment they finish onboarding.
  const referencePoint = profile.passiveToActivePromptLastShownAt ?? profile.registrationCompletedAt
  if (referencePoint) {
    const daysSinceReference = (now - referencePoint.getTime()) / MS_PER_DAY
    if (daysSinceReference >= CHECKIN_DAYS) return { trigger: 'SIXTY_DAY_CHECKIN' }
  }

  return null
}
