// What the Weekly Search Sprint asks for, by journey and stage (Journeys tab
// of the product design doc). Pure. getSuggestedActions puts these first and
// then fills from the general task menu, minus applications outside the
// active stages; Paused gets no plan at all.
//
// Items reuse the task menu's actionTypes where the behavior is the same
// (tracking companies, coffee chats, courses), so detection and points keep
// working; journey-only steps are plain text, like a coach's directive.

import type { JourneyStage, JourneyType } from './journey'
import { ACTIVE_SEARCH_STAGES } from './journey'

export type PlanItem = { text: string; actionType?: string }

const T = (text: string, actionType?: string): PlanItem => ({ text, actionType })

const JOURNEY_PLAN: Record<JourneyType, { firstWeek: PlanItem[]; ongoing: PlanItem[] }> = {
  LAID_OFF: {
    firstWeek: [
      T('File for unemployment benefits'),
      T('Review your severance and benefits dates'),
      T('Tell 10 people you’re looking', 'OUTREACH_MESSAGE'),
      T('List 20 target companies', 'WATCHLIST_ADD'),
      T('Book a coaching session'),
    ],
    ongoing: [T('Tell 5 more people what you’re looking for', 'OUTREACH_MESSAGE')],
  },
  READY_TO_MOVE: {
    firstWeek: [T('Refresh your résumé', 'RESUME_UPDATE'), T('Build a quiet list of target companies', 'WATCHLIST_ADD'), T('Line up two references you trust', 'REFERENCE_REQUESTED')],
    ongoing: [T('Have one quiet conversation at a target company', 'OUTREACH_CALL')],
  },
  EXPLORING_MOVE: {
    firstWeek: [T('Compare your pay with the market'), T('Refresh your LinkedIn quietly', 'LINKEDIN_SETUP'), T('Track 10 companies you’d consider', 'WATCHLIST_ADD')],
    ongoing: [T('Have one coffee chat this month', 'OUTREACH_CALL'), T('Close one skill gap', 'LEARNING_MODULE')],
  },
  PROMOTION: {
    firstWeek: [T('Write down three wins from this quarter'), T('Name the gap to the next level'), T('Benchmark the pay for the next level')],
    ongoing: [T('Plan your next conversation with your manager'), T('Meet with a potential sponsor', 'OUTREACH_CALL'), T('Close one gap to the next level', 'LEARNING_MODULE')],
  },
  CAREER_CHANGE: {
    firstWeek: [T('Map your transferable skills'), T('Pick three target roles in the new field'), T('Have an informational call with someone in the field', 'OUTREACH_CALL')],
    ongoing: [T('Have an informational call with someone in the field', 'OUTREACH_CALL'), T('Make progress on a bridge course or certificate', 'LEARNING_CERTIFICATE_STARTED')],
  },
  STUDENT_NEW_GRAD: {
    firstWeek: [T('Build your first résumé', 'RESUME_UPDATE'), T('List 10 employers you’d like to work for', 'WATCHLIST_ADD'), T('Have a call with an alum in your field', 'OUTREACH_CALL')],
    ongoing: [T('Do a mock interview', 'INTERVIEW_PREP')],
  },
  RETURNING: {
    firstWeek: [T('Write a two-sentence story for your break'), T('Refresh one skill', 'LEARNING_MODULE'), T('Look at interim or part-time work', 'INTERIM_PROFILE_CREATED')],
    ongoing: [T('Have a call with a mentor or former colleague', 'OUTREACH_CALL')],
  },
  NEXT_ACT: {
    firstWeek: [T('Draft your board and advisory profile'), T('List 10 organizations you’d like to serve', 'WATCHLIST_ADD'), T('Look at fractional and interim roles', 'INTERIM_PROFILE_CREATED')],
    ongoing: [T('Have two conversations about board or fractional work', 'OUTREACH_CALL')],
  },
}

const STAGE_PLAN: Partial<Record<JourneyStage, PlanItem[]>> = {
  INTERVIEWING: [T('Do a mock interview', 'INTERVIEW_PREP'), T('Practice answers to 3 behavioral questions', 'INTERVIEW_BEHAVIORAL_PRACTICE')],
  OFFER: [T('Prepare your negotiation: the number, your reasons, your walk-away')],
  LANDED: [T('Plan your first 90 days'), T('Thank the people who helped you', 'FOLLOW_UP_NOTE_SENT')],
}

// Task-menu types that are about applying for jobs.
export const APPLICATION_ACTION_TYPES = ['JOB_APPLICATION_SUBMITTED']

export function journeyPlanItems(journey: JourneyType | null, stage: JourneyStage | null, weekNumber: number): PlanItem[] {
  if (stage === 'PAUSED') return []
  const stageItems = stage ? (STAGE_PLAN[stage] ?? []) : []
  // Landed and Offer are about the new job, not the search that got there.
  if (stage === 'LANDED' || stage === 'OFFER') return stageItems
  const j = journey ? JOURNEY_PLAN[journey] : null
  const journeyItems = j ? (weekNumber <= 1 ? j.firstWeek : j.ongoing) : []
  return [...stageItems, ...journeyItems]
}

// Journey items first, then the general menu: no duplicate types, no
// application tasks unless the stage is an active search, nothing when Paused.
export function shapePlan<T extends { text: string; actionType?: string }>(
  journey: JourneyType | null,
  stage: JourneyStage | null,
  weekNumber: number,
  general: T[],
): (T | PlanItem)[] {
  if (stage === 'PAUSED') return []
  const allowApply = !stage || ACTIVE_SEARCH_STAGES.includes(stage)
  const out: (T | PlanItem)[] = []
  const types = new Set<string>()
  const texts = new Set<string>()
  for (const item of [...journeyPlanItems(journey, stage, weekNumber), ...general]) {
    if (!allowApply && item.actionType && APPLICATION_ACTION_TYPES.includes(item.actionType)) continue
    if (item.actionType ? types.has(item.actionType) : texts.has(item.text)) continue
    if (item.actionType) types.add(item.actionType)
    texts.add(item.text)
    out.push(item)
  }
  return out
}
