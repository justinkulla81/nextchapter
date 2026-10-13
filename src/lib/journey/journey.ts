// Journeys and stages (Product Design doc, Journeys tab). Pure and
// client-safe: the onboarding cards, the dashboard and the check-ins all read
// this one table. Server writes live in ./apply.ts.
//
// Journey = why someone is moving. Stage = how close they are to applying.
// Every NextChapter member has both: candidates who came in directly, college
// alumni, and outplacement seats alike.

import type { CurrentJobStatus, JourneyStage, JourneyType } from '@prisma/client'

export type { JourneyStage, JourneyType }

export type JourneyConfig = {
  key: JourneyType
  label: string // how we name it to the member
  card: { label: string; description: string } // the onboarding card
  goal: string // what success looks like, in the member's terms (dashboard header)
  defaultStage: JourneyStage
  confidentialByDefault: boolean
  // Written alongside the journey for code that still reads currentJobStatus.
  jobStatus: CurrentJobStatus
  // Employed people get "When do you want to start applying?" instead of
  // "How long have you been searching?".
  employed: boolean
}

export const JOURNEYS: JourneyConfig[] = [
  {
    key: 'LAID_OFF',
    label: 'Laid off or let go',
    card: { label: 'I was laid off or left my job', description: 'Start your search with a plan, not a guessing game.' },
    goal: 'The right role, fast.',
    defaultStage: 'APPLYING',
    confidentialByDefault: false,
    jobStatus: 'LAID_OFF',
    employed: false,
  },
  {
    key: 'READY_TO_MOVE',
    label: 'Ready for a new job',
    card: { label: "I'm working and ready for a new job", description: 'Land the offer before anyone at work knows.' },
    goal: 'An offer before anyone at work knows.',
    defaultStage: 'PREPARING',
    confidentialByDefault: true,
    jobStatus: 'EMPLOYED_CONSIDERING_MOVE',
    employed: true,
  },
  {
    key: 'EXPLORING_MOVE',
    label: 'Thinking about a move',
    card: { label: "I'm thinking about a move", description: 'Curious, or worried about layoffs: know your market before you need it.' },
    goal: "Know your market and your worth, so you're ready when the moment comes.",
    defaultStage: 'EXPLORING',
    confidentialByDefault: true,
    jobStatus: 'EMPLOYED_CONSIDERING_MOVE',
    employed: true,
  },
  {
    key: 'PROMOTION',
    label: 'Going for a promotion',
    card: { label: 'Looking for a promotion', description: 'Build the case for the next level, inside or outside.' },
    goal: 'The next level: promoted where you are, or a step-up offer.',
    defaultStage: 'PREPARING',
    confidentialByDefault: true,
    jobStatus: 'SEEKING_PROMOTION',
    employed: true,
  },
  {
    key: 'CAREER_CHANGE',
    label: 'Changing careers',
    card: { label: "I'm changing careers", description: 'Move into a new field with a plan and proof.' },
    goal: 'Your first role in the new field.',
    defaultStage: 'EXPLORING',
    confidentialByDefault: true,
    jobStatus: 'CAREER_PIVOT',
    employed: true,
  },
  {
    key: 'STUDENT_NEW_GRAD',
    label: 'Student or recent grad',
    card: { label: "I'm a student or recent grad", description: 'Your first job or internship, and a strong first year.' },
    goal: 'Your first job, and a strong first year.',
    defaultStage: 'PREPARING',
    confidentialByDefault: false,
    jobStatus: 'NEW_GRADUATE_FIRST_JOB',
    employed: false,
  },
  {
    key: 'RETURNING',
    label: 'Returning after a break',
    card: { label: "I'm returning after a break", description: 'Caregiving, health, a move: explain the gap with proof.' },
    goal: 'Back at work, with the gap explained.',
    defaultStage: 'PREPARING',
    confidentialByDefault: false,
    jobStatus: 'CAREGIVER_LEAVE_SABBATICAL',
    employed: false,
  },
  {
    key: 'NEXT_ACT',
    label: 'Planning the next act',
    card: { label: "I'm planning my next act", description: 'Board, fractional, consulting or part-time work that fits.' },
    goal: 'A mix of work that fits your income and your purpose.',
    defaultStage: 'EXPLORING',
    confidentialByDefault: false,
    jobStatus: 'EMPLOYED_CONSIDERING_MOVE',
    employed: true,
  },
]

export function getJourney(key: JourneyType): JourneyConfig {
  return JOURNEYS.find((j) => j.key === key)!
}

export const STAGES: { key: JourneyStage; label: string; plan: string; checkInDays: number }[] = [
  { key: 'EXPLORING', label: 'Exploring', plan: 'Learn your market. No application targets.', checkInDays: 30 },
  { key: 'PREPARING', label: 'Preparing', plan: 'Résumé, Dossier, targets and your story.', checkInDays: 14 },
  { key: 'APPLYING', label: 'Applying', plan: 'Applications and reach-outs every week.', checkInDays: 7 },
  { key: 'INTERVIEWING', label: 'Interviewing', plan: 'Prep, references and follow-ups.', checkInDays: 7 },
  { key: 'OFFER', label: 'Offer', plan: 'Negotiate and decide.', checkInDays: 7 },
  { key: 'LANDED', label: 'Landed', plan: 'Your first 90 days.', checkInDays: 90 },
  { key: 'PAUSED', label: 'Paused', plan: 'No nudges until you pick back up.', checkInDays: 30 },
]

export function getStage(key: JourneyStage) {
  return STAGES.find((s) => s.key === key)!
}

// Stages where the plan sets application targets and the daily pop-up may
// ask for applications.
export const ACTIVE_SEARCH_STAGES: JourneyStage[] = ['APPLYING', 'INTERVIEWING', 'OFFER']

// For members from before journeys: their old job status decides.
const FROM_JOB_STATUS: Record<CurrentJobStatus, JourneyType> = {
  LAID_OFF: 'LAID_OFF',
  RESIGNED: 'LAID_OFF',
  EMPLOYED_CONSIDERING_MOVE: 'EXPLORING_MOVE',
  SEEKING_PROMOTION: 'PROMOTION',
  CAREER_PIVOT: 'CAREER_CHANGE',
  NEW_GRADUATE_FIRST_JOB: 'STUDENT_NEW_GRAD',
  CAREGIVER_LEAVE_SABBATICAL: 'RETURNING',
  RELOCATED_FOR_FAMILY: 'RETURNING',
}

type JourneyFields = { journey?: JourneyType | null; journeyStage?: JourneyStage | null; currentJobStatus?: CurrentJobStatus | null }

export function effectiveJourney(p: JourneyFields): JourneyType | null {
  return p.journey ?? (p.currentJobStatus ? FROM_JOB_STATUS[p.currentJobStatus] : null)
}

export function effectiveStage(p: JourneyFields): JourneyStage | null {
  if (p.journeyStage) return p.journeyStage
  const j = effectiveJourney(p)
  return j ? getJourney(j).defaultStage : null
}

// "When do you want to start applying?" for employed journeys.
export const APPLY_TIMING = [
  { key: 'now', label: 'Now' },
  { key: '1_3_months', label: 'In 1 to 3 months' },
  { key: '3_6_months', label: 'In 3 to 6 months' },
  { key: 'curious', label: 'Just curious' },
] as const
export type ApplyTiming = (typeof APPLY_TIMING)[number]['key']

export function stageForTiming(journey: JourneyType, timing: ApplyTiming): JourneyStage {
  if (timing === 'now') return 'APPLYING'
  if (timing === 'curious') return 'EXPLORING'
  return journey === 'READY_TO_MOVE' || journey === 'PROMOTION' ? 'PREPARING' : 'EXPLORING'
}

// "Has anything changed?" One answer set everywhere it's asked: the app, the
// Saturday email, the college's check-ins. Each answer is a change.
export const CHECK_IN_ANSWERS = [
  { key: 'nothing', label: 'Nothing yet' },
  { key: 'ready', label: "I'm ready to start applying" },
  { key: 'interviewing', label: "I'm interviewing" },
  { key: 'laid_off', label: 'I was laid off' },
  { key: 'offer', label: 'I got an offer' },
  { key: 'landed', label: 'I started a new job or got promoted' },
  { key: 'break', label: "I'm taking a break" },
] as const
export type CheckInAnswer = (typeof CHECK_IN_ANSWERS)[number]['key']

export function changeForAnswer(answer: CheckInAnswer, current: { journey: JourneyType | null; stage: JourneyStage | null }): { journey?: JourneyType; stage?: JourneyStage } {
  switch (answer) {
    case 'nothing':
      // Coming back from a pause counts as picking back up.
      return current.stage === 'PAUSED' ? { stage: current.journey ? getJourney(current.journey).defaultStage : 'APPLYING' } : {}
    case 'ready':
      return { stage: 'APPLYING' }
    case 'interviewing':
      return { stage: 'INTERVIEWING' }
    case 'laid_off':
      return { journey: 'LAID_OFF', stage: 'APPLYING' }
    case 'offer':
      return { stage: 'OFFER' }
    case 'landed':
      return { stage: 'LANDED' }
    case 'break':
      return { stage: 'PAUSED' }
  }
}

// Due for "Has anything changed?" at the stage's pace.
export function checkInDue(p: JourneyFields & { journeyCheckedAt?: Date | null; journeyStageChangedAt?: Date | null; createdAt?: Date }, now = new Date()): boolean {
  const stage = effectiveStage(p)
  if (!stage) return false
  const last = p.journeyCheckedAt ?? p.journeyStageChangedAt ?? p.createdAt ?? null
  if (!last) return true
  return now.getTime() - new Date(last).getTime() >= getStage(stage).checkInDays * 86_400_000
}
