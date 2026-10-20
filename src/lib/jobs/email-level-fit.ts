import { CAREER_STAGES, memberStageWindow, stageOfRung, type StageMember } from '@/lib/jobs/career-stage'
import { assessYearsFit, parseYearsRange } from '@/lib/jobs/years-fit'

/**
 * Does a job sit at the member's level, for an EMAIL (Job Search Daily, fresh-job alerts,
 * the coach digest)? The one rule for "wrong level" (owner, 2026-10-19):
 *
 *   below_window / above_window  the job's stage is outside the member's stage window
 *                                (career-stage.ts: own stage, one up, one down; director and
 *                                up two down; changing careers one more down). The board's
 *                                seniority ring (one level beyond the window, shown as bridge
 *                                jobs) is for browsing, never for a handful of emailed picks.
 *   years_far / years_overqualified  the posting's stated years against the member's, under
 *                                the lenient years-fit.ts rule.
 *
 * A job with no level (employer-posted) or no stated years is judged on what it has.
 */
export type EmailLevelFit = 'fits' | 'below_window' | 'above_window' | 'years_far' | 'years_overqualified'

export function emailLevelFit(
  member: StageMember,
  job: { level: string | null; description?: string | null }
): EmailLevelFit {
  const stage = stageOfRung(job.level)
  if (stage) {
    const w = memberStageWindow(member)
    const i = CAREER_STAGES.indexOf(stage)
    if (i < w.lo) return 'below_window'
    if (i > w.hi) return 'above_window'
  }
  const band = assessYearsFit(member.yearsExperience, parseYearsRange(job.description ?? null)).band
  if (band === 'far') return 'years_far'
  if (band === 'overqualified') return 'years_overqualified'
  return 'fits'
}

export const fitsMemberLevel = (member: StageMember, job: { level: string | null; description?: string | null }) =>
  emailLevelFit(member, job) === 'fits'
