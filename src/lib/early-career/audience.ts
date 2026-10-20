// Who counts as early career, and what that changes. Pure and client-safe.
//
// Early career is a career stage, not a journey: a new grad has their own
// journey (STUDENT_NEW_GRAD), while someone 2 to 5 years in can be going for a
// promotion, ready to move or changing careers like anyone else. So the
// audience is read from the career ladder (src/lib/jobs/career-stage.ts), with
// the new-grad journey as a strong hint, and every early-career screen keys
// off this one function.

import type { CurrentJobStatus, JourneyStage, JourneyType } from '@prisma/client'
import { memberCareerStage, type StageMember } from '@/lib/jobs/career-stage'
import { effectiveJourney } from '@/lib/journey/journey'

export type EarlyCareerAudience = 'NEW_GRAD' | 'EARLY_CAREER'

export const AUDIENCE_LABEL: Record<EarlyCareerAudience, string> = {
  NEW_GRAD: 'New grad (0–2 years)',
  EARLY_CAREER: 'Early career (2–5 years)',
}

export type AudienceMember = StageMember & {
  journey?: JourneyType | null
  journeyStage?: JourneyStage | null
  currentJobStatus?: CurrentJobStatus | null
}

/**
 * NEW_GRAD for students and people up to 2 years in, EARLY_CAREER for 2 to 5
 * years, null for everyone else (including members whose stage is unknown,
 * who keep the experience they had before).
 */
export function earlyCareerAudience(m: AudienceMember): EarlyCareerAudience | null {
  const years = typeof m.yearsExperience === 'number' && m.yearsExperience >= 0 ? m.yearsExperience : null
  if (effectiveJourney(m) === 'STUDENT_NEW_GRAD') {
    // A student journey with real experience behind it (a working student, a
    // grad a few years out) is still early career, never mid-level.
    return years !== null && years >= 2 ? 'EARLY_CAREER' : 'NEW_GRAD'
  }
  const stage = memberCareerStage(m)
  if (stage === 'ENTRY') return 'NEW_GRAD'
  if (stage === 'EARLY') return 'EARLY_CAREER'
  return null
}

// Features whose visibility depends on the audience. Senior-only ones are on
// for everyone who is not early career (unchanged behavior); early-career
// ones are on only for the early-career audience.
export type AudienceFeature =
  | 'board_advisory' // board seats and advisory roles
  | 'interim_launch_plan' // interim, fractional and independent work
  | 'executive_upsells' // executive coaching and executive-recruiter upsells
  | 'early_career_plan' // /dashboard/early-career
  | 'major_role_picker'
  | 'grad_school_guide'
  | 'early_promotion_path'

export function featureVisible(feature: AudienceFeature, audience: EarlyCareerAudience | null): boolean {
  switch (feature) {
    case 'board_advisory':
    case 'interim_launch_plan':
    case 'executive_upsells':
      return audience === null
    case 'early_career_plan':
    case 'grad_school_guide':
      return audience !== null
    case 'major_role_picker':
      return audience === 'NEW_GRAD'
    case 'early_promotion_path':
      return audience === 'EARLY_CAREER'
  }
}

// Copy that changes with the audience. Kept here so screens never hardcode a
// senior example in front of a new grad.
export function targetRolePlaceholder(audience: EarlyCareerAudience | null): string {
  if (audience === 'NEW_GRAD') return 'e.g. Financial analyst'
  if (audience === 'EARLY_CAREER') return 'e.g. Senior product analyst'
  return 'e.g. VP of Operations'
}

/** The three self-identify buttons in onboarding, and the years each implies when none is given. */
export const CAREER_STAGE_CHOICES = [
  { key: 'new_grad', label: 'Student or new grad', detail: '0–2 years', defaultYears: 0 },
  { key: 'early', label: 'Early career', detail: '2–5 years', defaultYears: 3 },
  { key: 'experienced', label: 'Experienced', detail: '5+ years', defaultYears: null },
] as const
export type CareerStageChoice = (typeof CAREER_STAGE_CHOICES)[number]['key']

/**
 * The years to store for a self-identified stage. A typed number inside the
 * picked stage's range wins; a blank, or a number that contradicts an early
 * pick (a résumé-parsed "12" left in the box after choosing "Student or new
 * grad"), takes the stage's default. "Experienced" never overrides a number.
 */
export function yearsForChoice(choice: CareerStageChoice | null, typedYears: number | undefined): number | undefined {
  if (choice === 'new_grad' || choice === 'early') {
    const [lo, hi] = choice === 'new_grad' ? [0, 2] : [2, 5]
    if (typedYears !== undefined && typedYears >= lo && typedYears < hi) return typedYears
    return CAREER_STAGE_CHOICES.find((c) => c.key === choice)!.defaultYears ?? undefined
  }
  return typedYears
}

/** The button to pre-select for a member re-visiting the form. */
export function choiceForMember(m: AudienceMember): CareerStageChoice | null {
  const a = earlyCareerAudience(m)
  if (a === 'NEW_GRAD') return 'new_grad'
  if (a === 'EARLY_CAREER') return 'early'
  if (memberCareerStage(m)) return 'experienced'
  return null
}
