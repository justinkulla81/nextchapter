// The payoff of each bundle: what the member gets for answering, computed from the answers so it updates
// as they answer. Every line rests on something the site really does (the first-week plan, the weekly
// target, the job matching), never a made-up number. Pure: payoff.test.ts.

import type { CoachingStylePreference } from '@prisma/client'
import { getJourney, type JourneyStage, type JourneyType, type MoveDriver } from '@/lib/journey/journey'
import { isCasualIntensity, isNotSearching } from '@/lib/journey/intensity'
import { journeyPlanItems } from '@/lib/journey/plan'
import { paceFor, pointsNeededForA } from '@/lib/weekly/action-effort'
import { whereYouAreWrites } from '@/lib/onboarding/answers'
import { journeyOfSituation, type Answers, type BundleId } from '@/lib/onboarding/bundles'

export type PayoffKind = 'plan' | 'resume' | 'jobs' | 'tone'

export interface Payoff {
  kind: PayoffKind
  headline: string
  lines: string[]
  /** The places this changes, as chips: Plan, Home, Jobs, Network. */
  chips: string[]
}

export interface JobCounts {
  /** Matches before these answers (null when matching has nothing to go on yet). */
  baseline: number | null
  /** Matches with them. */
  now: number | null
}

export interface PayoffInput {
  journey: JourneyType | null
  /** Facts already known: the stored intensity and stage, the labels the résumé filled in. */
  storedIntensity?: string | null
  storedStage?: JourneyStage | null
  prefilled?: readonly string[]
  jobs?: JobCounts | null
}

const n = (x: number) => x.toLocaleString('en-US')

/** The steps of the member's first week, three at most, as the plan will really show them. */
export function firstWeekPreview(journey: JourneyType, answers: Answers, storedStage?: JourneyStage | null, storedDriver: MoveDriver | null = null, now = new Date()): string[] {
  const writes = whereYouAreWrites(journey, answers, now)
  const stage = writes.stage ?? storedStage ?? getJourney(journey).defaultStage
  const driver = (writes.details.moveDriver as MoveDriver | undefined) ?? storedDriver
  return journeyPlanItems(journey, stage, 1, null, driver)
    .map((i) => i.text)
    .slice(0, 3)
}

/** Minutes of search work in the first week: one point is one minute, halved for a light pace. */
export function weeklyTargetMinutes(journey: JourneyType | null, stage: JourneyStage | null, intensity: string | null | undefined): number {
  const light = isNotSearching(journey, stage) || isCasualIntensity(intensity)
  return pointsNeededForA(1, paceFor(light))
}

/** A line of the coach's voice in the chosen tone, built on the member's real first step. */
export function sampleNote(style: CoachingStylePreference | string | null | undefined, step: string | null): string {
  const s = (step ?? 'Take one small step on your search').replace(/[.]+$/, '')
  switch (style) {
    case 'TOUGH_LOVE':
      return `Today’s step: ${s}. Do it before lunch, then tell us how it went.`
    case 'GENTLE_ENCOURAGEMENT':
      return `Whenever you have a few minutes, here is a gentle place to start: ${s}. Any small step counts.`
    case 'SOMEWHERE_IN_BETWEEN':
      return `Your next step is: ${s}. Do the first part today; the rest can wait until tomorrow.`
    default:
      return `Your next step: ${s}.`
  }
}

/** "111 jobs became 261", or an honest line when we cannot count yet. */
export function jobsLine(jobs: JobCounts | null | undefined): string {
  if (!jobs || jobs.now === null) return 'We will count the jobs that fit as soon as your account is ready.'
  if (jobs.baseline === null || jobs.baseline === jobs.now) return `${n(jobs.now)} open job${jobs.now === 1 ? '' : 's'} fit what you have told us so far.`
  if (jobs.now > jobs.baseline) return `${n(jobs.baseline)} jobs became ${n(jobs.now)}.`
  return `${n(jobs.now)} job${jobs.now === 1 ? '' : 's'} fit these answers, down from ${n(jobs.baseline)}. A narrower list is fine if it is what you want.`
}

export function computePayoff(id: BundleId, answers: Answers, input: PayoffInput): Payoff {
  switch (id) {
    case 'where_you_are': {
      const journey = journeyOfSituation(answers.situation) ?? input.journey
      if (!journey) return { kind: 'plan', headline: 'Pick the one that fits and your first week appears here.', lines: [], chips: ['Plan', 'Home'] }
      const steps = firstWeekPreview(journey, answers, input.storedStage)
      return {
        kind: 'plan',
        headline: steps.length > 0 ? 'Your first week, in three steps.' : 'Your home page is ready for you.',
        lines: steps.length > 0 ? steps : [getJourney(journey).goal],
        chips: ['Plan', 'Home'],
      }
    }
    case 'resume': {
      const got = input.prefilled ?? []
      return got.length > 0
        ? { kind: 'resume', headline: `We filled in ${got.length} answer${got.length === 1 ? '' : 's'} for you.`, lines: [...got], chips: ['Jobs', 'Profile'] }
        : { kind: 'resume', headline: 'Upload your résumé and we fill in the answers for you.', lines: [], chips: ['Jobs', 'Profile'] }
    }
    case 'aiming': {
      const ready = !!answers.function && !!answers.level
      return {
        kind: 'jobs',
        headline: ready ? jobsLine(input.jobs) : 'Choose your function and level to see how many jobs fit.',
        lines: answers.targetRole?.trim() ? [`Jobs like “${answers.targetRole.trim()}” come first.`] : [],
        chips: ['Jobs', 'Learn'],
      }
    }
    case 'where': {
      const ready = !!answers.workSetup
      return {
        kind: 'jobs',
        headline: ready ? jobsLine(input.jobs) : 'Choose how you want to work and the count of jobs that fit updates here.',
        lines: answers.relocation === 'yes' ? ['Jobs in other states are now on the table.'] : [],
        chips: ['Jobs'],
      }
    }
    case 'coach': {
      const journey = input.journey
      const intensity = answers.intensity ?? input.storedIntensity ?? null
      const stage = input.storedStage ?? (journey ? getJourney(journey).defaultStage : null)
      const minutes = weeklyTargetMinutes(journey, stage, intensity)
      const first = journey && stage ? (journeyPlanItems(journey, stage, 1)[0]?.text ?? null) : null
      return {
        kind: 'tone',
        headline: `Your first week is about ${minutes} minutes of real search work.`,
        lines: [`A note from us, in your tone: “${sampleNote(answers.pushStyle, first)}”`],
        chips: ['Home', 'Plan'],
      }
    }
  }
}
