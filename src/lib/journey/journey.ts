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
  // False for people who aren't looking to leave: no search questions, no
  // application targets, no "quietly looking".
  searching: boolean
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
    searching: true,
  },
  {
    key: 'EXPLORING_MOVE',
    label: 'Thinking about a move',
    card: {
      label: "I'm working and thinking about a move",
      description: 'Know your market and your worth, and land the offer before anyone at work knows.',
    },
    goal: 'Know your market and your worth, and be ready to move quietly when you choose.',
    defaultStage: 'EXPLORING',
    confidentialByDefault: true,
    jobStatus: 'EMPLOYED_CONSIDERING_MOVE',
    employed: true,
    searching: true,
  },
  {
    key: 'GROWING',
    label: 'Managing my career',
    card: {
      label: "I'm happy where I am and want to manage my career",
      description: 'Reviews, raises, promotions, new skills, and a job that holds up in a downturn.',
    },
    goal: 'A stronger case at work: better pay, the next level, and skills that hold their value.',
    defaultStage: 'STAYING',
    confidentialByDefault: true,
    jobStatus: 'EMPLOYED_CONSIDERING_MOVE',
    employed: true,
    searching: false,
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
    searching: true,
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
    searching: true,
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
    searching: true,
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
    searching: true,
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
    searching: true,
  },
]

// "Ready for a new job" was folded into "Thinking about a move": how soon
// someone will apply is the stage, and what's driving the move is
// MOVE_DRIVERS below. The enum value stays so existing rows keep reading;
// every reader goes through normalizeJourney.
const LEGACY_JOURNEY: Partial<Record<JourneyType, JourneyType>> = { READY_TO_MOVE: 'EXPLORING_MOVE' }

export function normalizeJourney(key: JourneyType): JourneyType {
  return LEGACY_JOURNEY[key] ?? key
}

export function getJourney(key: JourneyType): JourneyConfig {
  const k = normalizeJourney(key)
  return JOURNEYS.find((j) => j.key === k)!
}

export const STAGES: { key: JourneyStage; label: string; plan: string; checkInDays: number }[] = [
  { key: 'EXPLORING', label: 'Exploring', plan: 'Learn your market and your worth. No application targets.', checkInDays: 30 },
  { key: 'PREPARING', label: 'Preparing', plan: 'Get ready: résumé, proof, targets and your story.', checkInDays: 14 },
  { key: 'APPLYING', label: 'Applying', plan: 'Apply and reach out every week.', checkInDays: 7 },
  { key: 'INTERVIEWING', label: 'Interviewing', plan: 'Prepare for each round, keep references warm, follow up.', checkInDays: 7 },
  { key: 'OFFER', label: 'Offer', plan: 'Know your worth, negotiate and decide.', checkInDays: 7 },
  { key: 'LANDED', label: 'Landed', plan: 'Start strong: your first 90 days, and thank the people who helped.', checkInDays: 90 },
  { key: 'STAYING', label: 'Managing your career', plan: 'Grow where you are: reviews, pay, skills and a career that holds up.', checkInDays: 30 },
]

// There is no "on a break": someone who is not looking is managing their
// career, with a plan, a menu and emails of their own. PAUSED stays in the
// database enum only so old rows keep reading; everything goes through this.
export function normalizeStage(key: JourneyStage): JourneyStage {
  return key === 'PAUSED' ? 'STAYING' : key
}

export function getStage(key: JourneyStage) {
  const k = normalizeStage(key)
  return STAGES.find((s) => s.key === k)!
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
  const j = p.journey ?? (p.currentJobStatus ? FROM_JOB_STATUS[p.currentJobStatus] : null)
  return j ? normalizeJourney(j) : null
}

export function effectiveStage(p: JourneyFields): JourneyStage | null {
  if (p.journeyStage) return normalizeStage(p.journeyStage)
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
  const j = normalizeJourney(journey)
  if (j === 'PROMOTION') return 'PREPARING'
  // Thinking about a move: a move in the next few months is worth preparing for.
  if (j === 'EXPLORING_MOVE') return timing === '1_3_months' ? 'PREPARING' : 'EXPLORING'
  return 'EXPLORING'
}

// "What's driving this?" for the Thinking about a move journey. Optional;
// kept in journeyDetails.moveDriver. Someone worried about a layoff gets the
// same plan plus the steps that matter when there may be a clock.
export const MOVE_DRIVERS = [
  { key: 'options', label: 'Keeping my options open' },
  { key: 'unhappy', label: 'Ready to leave my job' },
  { key: 'layoff_worry', label: 'Worried about a layoff' },
] as const
export type MoveDriver = (typeof MOVE_DRIVERS)[number]['key']

export function moveDriverOf(details: unknown): MoveDriver | null {
  const v = (details as { moveDriver?: unknown } | null)?.moveDriver
  return MOVE_DRIVERS.some((d) => d.key === v) ? (v as MoveDriver) : null
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
  { key: 'managing', label: "I'm not looking right now. I want to manage my career" },
] as const
export type CheckInAnswer = (typeof CHECK_IN_ANSWERS)[number]['key']

export function changeForAnswer(answer: CheckInAnswer, _current: { journey: JourneyType | null; stage: JourneyStage | null }): { journey?: JourneyType; stage?: JourneyStage } {
  switch (answer) {
    case 'nothing':
      return {}
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
    case 'managing':
      return { stage: 'STAYING' }
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

// One line for the Market Reality Report prompt: who this person is and what
// a useful read looks like for them. Same LLM call, no extra cost.
const EXPLORING_FRAMING =
  'Employed and thinking about a move, not applying yet. Answer how marketable they are, what they are worth, and what would make them ready. Do not push application volume.'
const QUIET_SEARCH_FRAMING =
  'Employed and getting ready to move, searching quietly. Frame advice around a confidential search that fits around a job; never assume they are out of work.'

export const REPORT_FRAMING: Record<JourneyType, string> = {
  LAID_OFF: 'Out of work after a layoff or leaving a job. Optimize for the right role, fast; be direct about what is slowing the search.',
  READY_TO_MOVE: QUIET_SEARCH_FRAMING, // legacy value; reportFraming normalizes it
  EXPLORING_MOVE: EXPLORING_FRAMING,
  GROWING:
    'Employed and staying, growing where they are. Frame the read around the next performance review, a raise or promotion case, how their pay compares with the market, the skills that keep them valuable, and how recession-proof their role and profile are. Do not push applications or assume they want to leave.',
  PROMOTION: 'Employed and going for the next level, inside or outside. Frame the read around the gap to the next level and the leverage that wins the promotion.',
  CAREER_CHANGE: 'Moving into a new function or industry. Judge them against the target field, name transferable strengths, and the bridge steps (projects, credentials, informational calls) that make the switch credible.',
  STUDENT_NEW_GRAD: 'A student or recent graduate looking for an internship or first job. Judge them against entry-level expectations; lack of experience is normal, not a weakness.',
  RETURNING: 'Returning after a break (caregiving, health, sabbatical, a move). Treat the gap as context, not a flaw; focus on a credible story and refreshed skills.',
  NEXT_ACT: 'Planning a next act after a long career: board, fractional, consulting or part-time work. Judge them against advisory and fractional roles, not full-time ladder jobs.',
}

const DRIVER_FRAMING: Record<MoveDriver, string> = {
  options: '',
  unhappy: ' They are unhappy at work: be honest about whether the market offers something better and what they would trade.',
  layoff_worry:
    ' They are worried about a layoff: say how long a search would likely take in their market and what a runway looks like. Stay measured, never alarmist, and do not predict that a layoff will happen.',
}

// What the report should know about this member: journey, stage and, for a
// move, what is driving it. Thinking about a move reads differently once
// someone is preparing or applying than while they are only exploring.
export function reportFraming(journey: JourneyType, stage: JourneyStage | null, driver: MoveDriver | null = null): string {
  const j = normalizeJourney(journey)
  if (j !== 'EXPLORING_MOVE') return REPORT_FRAMING[j]
  const base = stage && stage !== 'EXPLORING' && stage !== 'STAYING' ? QUIET_SEARCH_FRAMING : EXPLORING_FRAMING
  return base + (driver ? DRIVER_FRAMING[driver] : '')
}

// Not looking for a new job right now: managing their career, or already
// landed. These members get no job-listing emails (Job Search Daily, fresh
// job alerts); their plan and emails are about the job they have.
export function notLookingNow(p: JourneyFields): boolean {
  const stage = effectiveStage(p)
  return stage === 'STAYING' || stage === 'LANDED'
}
