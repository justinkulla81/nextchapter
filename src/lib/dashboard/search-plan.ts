import 'server-only'
import { DOSSIER_REFERENCE_TARGET } from '@/lib/scoring/dossier-unlock'
import { referenceCountToTier } from '@/lib/references/reference-count-tier'
import { badgeCountToTier } from '@/lib/learning/badge-count-tier'
import { outreachCountToTier } from '@/lib/network/outreach-count-tier'
import { applicationCountToTier } from '@/lib/network/application-count-tier'
import { signupCountToTier } from '@/lib/interim-work/signup-count-tier'
import { linkedInActivityCountToTier } from '@/lib/marketing/linkedin-activity-count-tier'
import { WEEKLY_ENGINE_LABEL, type ConfidenceLevel, type WeeklyEngineKey } from '@/lib/scoring/grade'

// Post-activation "Search Plan" — the six broader areas a candidate works
// once they've cleared the dashboard-wide hard gate (see access-gate.ts),
// each of which already has its own progressive-unlock tier card on its own
// page (ReferenceCheckSummary, or a TierSummaryCard instance on
// find-my-job/learning/network/interim-work/marketing-plan). This module
// only assembles a same-numbers summary row per area for the dashboard-level
// SearchPlanCard — it never recomputes a count or a tier threshold that one
// of those pages/tier-fns doesn't already own.
export type SearchPlanAreaKey = 'references' | 'skills' | 'networking' | 'applications' | 'interim_work' | 'posting'

export interface SearchPlanArea {
  area: SearchPlanAreaKey
  label: string
  href: string
  tier: ConfidenceLevel
  /** Short pill text, e.g. "3 of 5 references" or "2 skill badges earned". */
  progressLabel: string
  whyItMatters: string
}

// Which of the four weekly-effort engines (grade.ts) each area's real
// activity actually feeds, per engineForActionType/ENGINE_BY_ACTION_TYPE in
// action-effort.ts: REFERENCE_ADDED and JOB_APPLICATION_SUBMITTED both
// count toward 'effort'; LEARNING_* toward 'learning'; OUTREACH_MESSAGE and
// INTERIM_PROFILE_CREATED toward 'connecting'; LINKEDIN_POST_IDEA/
// THOUGHT_LEADERSHIP_SHARE toward 'working'. Used only to decide whether a
// real, this-week-specific "why it matters" line applies (see
// laggingEngines below) — the mapping itself is derived from that existing
// table, not invented here.
const AREA_ENGINE: Record<SearchPlanAreaKey, WeeklyEngineKey> = {
  references: 'effort',
  skills: 'learning',
  networking: 'connecting',
  applications: 'effort',
  interim_work: 'connecting',
  posting: 'working',
}

// Stable, generic fallback for whenever this week's grade doesn't name this
// area's engine as lagging (see laggingEngines/CATEGORY_MINIMUM_SCORE_FLOOR
// in grade.ts) — an honest, always-true statement of why the area matters,
// never a fabricated per-candidate reason.
const GENERIC_WHY: Record<SearchPlanAreaKey, string> = {
  references:
    'References are one of the strongest signals a hiring manager trusts — they back up what your resume claims.',
  skills:
    'Staying current keeps your background matched to what roles actually ask for now, not just what you did before.',
  networking:
    "Warm outreach is still the highest-signal way in — most roles get filled through a real conversation, not just an application.",
  applications:
    "A steady, focused application volume is what actually produces interviews — sporadic bursts don't.",
  interim_work:
    'Interim and fractional work keeps momentum — and income — going while your full-time search continues.',
  posting:
    "Staying visible compounds — recruiters and your network see you're active, not just quietly searching.",
}

function whyItMatters(area: SearchPlanAreaKey, laggingEngines: WeeklyEngineKey[]): string {
  const engine = AREA_ENGINE[area]
  if (laggingEngines.includes(engine)) {
    return `Your ${WEEKLY_ENGINE_LABEL[engine]} engine is behind this week's bar — activity here is the fastest way to close that gap.`
  }
  return GENERIC_WHY[area]
}

function plural(count: number, unit: string): string {
  return count === 1 ? unit : `${unit}s`
}

export function buildSearchPlanAreas(input: {
  completedReferencesCount: number
  learningBadgeCount: number
  outreachLogCount: number
  totalApplications: number
  interimSignupCount: number
  linkedInActivityCount: number
  laggingEngines: WeeklyEngineKey[]
}): SearchPlanArea[] {
  const { laggingEngines } = input

  return [
    {
      area: 'references',
      label: 'References',
      href: '/dashboard/references',
      tier: referenceCountToTier(input.completedReferencesCount),
      progressLabel: `${input.completedReferencesCount} of ${DOSSIER_REFERENCE_TARGET} references`,
      whyItMatters: whyItMatters('references', laggingEngines),
    },
    {
      area: 'skills',
      label: 'Skills',
      href: '/dashboard/learning',
      tier: badgeCountToTier(input.learningBadgeCount),
      progressLabel: `${input.learningBadgeCount} skill ${plural(input.learningBadgeCount, 'badge')} earned`,
      whyItMatters: whyItMatters('skills', laggingEngines),
    },
    {
      area: 'networking',
      label: 'Networking',
      href: '/dashboard/network',
      tier: outreachCountToTier(input.outreachLogCount),
      progressLabel: `${input.outreachLogCount} outreach ${plural(input.outreachLogCount, 'touchpoint')} logged`,
      whyItMatters: whyItMatters('networking', laggingEngines),
    },
    {
      area: 'applications',
      label: 'Applications',
      href: '/dashboard/find-my-job',
      tier: applicationCountToTier(input.totalApplications),
      progressLabel: `${input.totalApplications} ${plural(input.totalApplications, 'application')} logged`,
      whyItMatters: whyItMatters('applications', laggingEngines),
    },
    {
      area: 'interim_work',
      label: 'Interim Work',
      href: '/dashboard/interim-work',
      tier: signupCountToTier(input.interimSignupCount),
      progressLabel: `${input.interimSignupCount} interim ${plural(input.interimSignupCount, 'signup')}`,
      whyItMatters: whyItMatters('interim_work', laggingEngines),
    },
    {
      area: 'posting',
      label: 'Posting',
      href: '/dashboard/marketing-plan',
      tier: linkedInActivityCountToTier(input.linkedInActivityCount),
      progressLabel: `${input.linkedInActivityCount} ${plural(input.linkedInActivityCount, 'day')} of LinkedIn activity logged`,
      whyItMatters: whyItMatters('posting', laggingEngines),
    },
  ]
}
