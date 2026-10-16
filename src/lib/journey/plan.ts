// What the Weekly Search Sprint asks for, by journey and stage (Journeys tab
// of the product design doc). Pure. getSuggestedActions puts these first and
// then fills from the general task menu, minus applications outside the
// active stages. Managing your career has its own plan, whatever the journey.
//
// Items reuse the task menu's actionTypes where the behavior is the same
// (tracking companies, coffee chats, courses), so detection and points keep
// working; journey-only steps are plain text, like a coach's directive.

import type { JourneyStage, JourneyType, MoveDriver } from './journey'
import { ACTIVE_SEARCH_STAGES, normalizeJourney } from './journey'

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
  // Thinking about a move: this is the plan while exploring. Once someone is
  // preparing or applying they get QUIET_SEARCH_PLAN instead (see journeyPlanItems).
  EXPLORING_MOVE: {
    firstWeek: [T('Compare your pay with the market'), T('Refresh your LinkedIn quietly', 'LINKEDIN_SETUP'), T('Track 10 companies you’d consider', 'WATCHLIST_ADD')],
    ongoing: [T('Have one coffee chat this month', 'OUTREACH_CALL'), T('Close one skill gap', 'LEARNING_MODULE')],
  },
  GROWING: {
    firstWeek: [
      T('Write down your wins from the last six months'),
      T('Prepare for your next performance review: results, goals and what you’ll ask for'),
      T('Benchmark your pay against the market'),
      T('Name one skill that keeps you valuable if the market shifts'),
    ],
    ongoing: [
      T('Plan your next conversation with your manager about growth or pay'),
      T('Make progress on a skill course', 'LEARNING_MODULE'),
      T('Strengthen your recession-proof profile: keep your résumé, references and network current', 'RESUME_UPDATE'),
      T('Meet with a sponsor or mentor', 'OUTREACH_CALL'),
    ],
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
    firstWeek: [
      T('Build your first résumé from internships, projects and coursework', 'RESUME_UPDATE'),
      T('Pick two or three target roles from your major'),
      T('Set up your LinkedIn', 'LINKEDIN_SETUP'),
      T('List 10 employers you’d like to work for', 'WATCHLIST_ADD'),
      T('Have a call with an alum in your field', 'OUTREACH_CALL'),
    ],
    ongoing: [
      T('Do a mock interview', 'INTERVIEW_PREP'),
      T('Practice answers to 3 behavioral questions', 'INTERVIEW_BEHAVIORAL_PRACTICE'),
      T('Ask one more alum for an informational interview', 'OUTREACH_MESSAGE'),
      T('Make progress on a free course your target role asks for', 'LEARNING_MODULE'),
    ],
  },
  RETURNING: {
    firstWeek: [T('Write a two-sentence story for your break'), T('Refresh one skill', 'LEARNING_MODULE'), T('Look at interim or part-time work', 'INTERIM_PROFILE_CREATED')],
    ongoing: [T('Have a call with a mentor or former colleague', 'OUTREACH_CALL')],
  },
  NEXT_ACT: {
    firstWeek: [T('Draft your board and advisory profile'), T('List 10 organizations you’d like to serve', 'WATCHLIST_ADD'), T('Look at fractional and interim roles', 'INTERIM_PROFILE_CREATED')],
    ongoing: [T('Have two conversations about board or fractional work', 'OUTREACH_CALL')],
  },
  // Building something of their own: we track and check in. Deliberately light.
  ENTREPRENEUR: {
    firstWeek: [T('Tell us what you are building and where it stands'), T('Note what you need from your career while you build: income, benefits, a way back')],
    ongoing: [T('Check in: what moved on your venture this month'), T('Keep one door open: one conversation this month with someone in your field', 'OUTREACH_CALL')],
  },
  // Happy with fractional work: the job is the pipeline, not a search.
  FRACTIONAL: {
    firstWeek: [
      T('List your current engagements and when each one ends'),
      T('Write your one-line offer: who you help and the result'),
      T('Check your rate against the market'),
      T('Ask a client for a referral or a testimonial', 'REFERENCE_REQUESTED'),
    ],
    ongoing: [
      T('Start the renewal conversation 30 days before an engagement ends', 'OUTREACH_CALL'),
      T('Have two conversations with potential next clients', 'OUTREACH_CALL'),
      T('Publish one post that shows how you work', 'LINKEDIN_POST_IDEA'),
    ],
  },
  // On leave or taking time off: keep it gentle and make the return easy.
  TIME_OFF: {
    firstWeek: [T('Set your expected return date'), T('Check your leave, pay and benefits dates'), T('Write down what you want from work when you are back')],
    ongoing: [T('Keep one relationship warm: one note or coffee a month', 'OUTREACH_MESSAGE'), T('Learn something small, only if you want to', 'LEARNING_MODULE')],
  },
}

// Journeys whose members are not looking for a job: in Managing your career
// they get their own plan. Everyone else in that stage gets the career plan.
const OWN_PLAN_WHEN_STAYING = new Set<JourneyType>(['GROWING', 'ENTREPRENEUR', 'FRACTIONAL', 'TIME_OFF'])

const STAGE_PLAN: Partial<Record<JourneyStage, PlanItem[]>> = {
  INTERVIEWING: [T('Do a mock interview', 'INTERVIEW_PREP'), T('Practice answers to 3 behavioral questions', 'INTERVIEW_BEHAVIORAL_PRACTICE')],
  OFFER: [T('Prepare your negotiation: the number, your reasons, your walk-away')],
  LANDED: [T('Plan your first 90 days'), T('Thank the people who helped you', 'FOLLOW_UP_NOTE_SENT')],
}

// Thinking about a move, once the member is preparing or applying: a search
// that fits around a job, with nobody at work finding out.
const QUIET_SEARCH_PLAN = {
  firstWeek: [T('Refresh your résumé', 'RESUME_UPDATE'), T('Build a quiet list of target companies', 'WATCHLIST_ADD'), T('Line up two references you trust', 'REFERENCE_REQUESTED')],
  ongoing: [T('Have one quiet conversation at a target company', 'OUTREACH_CALL')],
}

// What's driving a move adds its own steps. Someone worried about a layoff
// may have a clock, so the runway and benefits come first.
const DRIVER_PLAN: Record<MoveDriver, { firstWeek: PlanItem[]; ongoing: PlanItem[] }> = {
  options: { firstWeek: [], ongoing: [] },
  unhappy: { firstWeek: [T('Write down what you want in the next role, and what you won’t accept')], ongoing: [] },
  layoff_worry: {
    firstWeek: [
      T('Check your runway: savings, likely severance and benefits dates'),
      T('See what unemployment benefits would pay in your state'),
      T('Keep your résumé and references ready to go', 'RESUME_UPDATE'),
    ],
    ongoing: [T('Check the news about your company and keep your résumé current')],
  },
}

// Time gates. A search that has run a while without results needs different
// things to do, not the same plan in firmer words. Each gate adds steps that
// open a new door (a teardown, a wider target, interim income, a coach, a
// different lane) once the member has been in an active search stage for
// that many weeks. Later gates stack on earlier ones until the member moves
// stage, which resets the clock.
export const SEARCH_GATES: { fromWeek: number; items: PlanItem[] }[] = [
  {
    fromWeek: 3,
    items: [T('Run the Résumé Fixer against the roles you want', 'RESUME_UPDATE'), T('Ask two people you trust what is unclear in your résumé')],
  },
  {
    fromWeek: 6,
    items: [T('Widen your targets: add a second role title or industry'), T('Look at interim or fractional work while you search', 'INTERIM_PROFILE_CREATED')],
  },
  {
    fromWeek: 9,
    items: [T('Book a coaching session to review what is not working'), T('Ask one person who hires for your kind of role to critique your pitch', 'OUTREACH_CALL')],
  },
  {
    fromWeek: 13,
    items: [T('Test a different lane: one conversation about an adjacent role or field', 'OUTREACH_CALL'), T('Review your runway and benefits, and decide what you can bridge with')],
  },
]

export function gateItems(stage: JourneyStage | null, weeksInStage: number): PlanItem[] {
  if (!stage || (stage !== 'APPLYING' && stage !== 'INTERVIEWING')) return []
  return SEARCH_GATES.filter((g) => weeksInStage >= g.fromWeek).flatMap((g) => g.items)
}

// Looking casually while in an active stage: open to the right thing, not in a
// hurry, maybe already earning from fractional or interim work. A light plan
// that keeps the right opportunity able to find them, with no application volume.
const CASUAL_PLAN: PlanItem[] = [
  T('Look through this week’s strongest-fit roles and save any worth a second look'),
  T('Have one conversation about what you do and what you would say yes to', 'OUTREACH_CALL'),
  T('Keep your references and Executive Dossier current so the right thing can find you', 'REFERENCE_REQUESTED'),
]

// Task-menu types that are about applying for jobs.
export const APPLICATION_ACTION_TYPES = ['JOB_APPLICATION_SUBMITTED']

// Early career (src/lib/early-career/audience.ts) is a career stage that sits
// on top of any journey: someone 2 to 5 years in going for a promotion gets
// the promotion plan plus these; a new grad who was laid off gets the laid-off
// plan plus the new-grad basics. Senior-only steps are dropped for both.
export type PlanAudience = 'NEW_GRAD' | 'EARLY_CAREER' | null

const AUDIENCE_PLAN: Record<'NEW_GRAD' | 'EARLY_CAREER', { firstWeek: PlanItem[]; ongoing: PlanItem[] }> = {
  NEW_GRAD: {
    firstWeek: [T('Ask an alum for a 20-minute informational interview', 'OUTREACH_CALL'), T('Practice answers to 3 behavioral questions', 'INTERVIEW_BEHAVIORAL_PRACTICE')],
    ongoing: [T('Ask an alum for a 20-minute informational interview', 'OUTREACH_CALL')],
  },
  EARLY_CAREER: {
    firstWeek: [T('Write down three wins with numbers'), T('Find a mentor or sponsor two levels up', 'OUTREACH_CALL'), T('Check your pay against the market')],
    ongoing: [T('Have a coffee chat with someone two levels up', 'OUTREACH_CALL'), T('Close one skill gap for the next level', 'LEARNING_MODULE')],
  },
}

const PROMOTION_COVERS = ['Write down three wins with numbers', 'Check your pay against the market']

// Steps built for senior members (interim and fractional work, board seats).
export const SENIOR_ONLY_ACTION_TYPES = ['INTERIM_PROFILE_CREATED']
const SENIOR_ONLY_TEXT = /\b(fractional|interim)\b|\bboard (seats?|and advisory|positions?|work)\b|\badvisory (boards?|roles?|profile)\b/i

function isSeniorOnly(item: { text: string; actionType?: string }): boolean {
  return (!!item.actionType && SENIOR_ONLY_ACTION_TYPES.includes(item.actionType)) || SENIOR_ONLY_TEXT.test(item.text)
}

export function journeyPlanItems(journey: JourneyType | null, stage: JourneyStage | null, weekNumber: number, audience: PlanAudience = null, driver: MoveDriver | null = null): PlanItem[] {
  // Not looking right now: the plan is about managing the career they have,
  // whichever journey they started on.
  if (stage === 'STAYING' || stage === 'PAUSED') {
    const own = journey ? normalizeJourney(journey) : null
    const plan = own && OWN_PLAN_WHEN_STAYING.has(own) ? JOURNEY_PLAN[own] : JOURNEY_PLAN.GROWING
    const own_items = weekNumber <= 1 ? plan.firstWeek : plan.ongoing
    return audience ? own_items.filter((i) => !isSeniorOnly(i)) : own_items
  }
  const stageItems = stage ? (STAGE_PLAN[stage] ?? []) : []
  // A first offer gets the first-salary framing.
  if (stage === 'OFFER' && audience === 'NEW_GRAD') return [T('Compare your offer with starting pay for the role, then ask for more once, politely')]
  // Landed and Offer are about the new job, not the search that got there.
  if (stage === 'LANDED' || stage === 'OFFER') return stageItems
  const key = journey ? normalizeJourney(journey) : null
  let j = key ? JOURNEY_PLAN[key] : null
  let driverItems: PlanItem[] = []
  if (key === 'EXPLORING_MOVE') {
    if (stage && stage !== 'EXPLORING') j = QUIET_SEARCH_PLAN
    if (driver) driverItems = weekNumber <= 1 ? DRIVER_PLAN[driver].firstWeek : DRIVER_PLAN[driver].ongoing
  }
  const journeyItems = j ? (weekNumber <= 1 ? j.firstWeek : j.ongoing) : []
  const a = audience ? AUDIENCE_PLAN[audience] : null
  // The promotion plan already asks for wins and next-level pay.
  const audienceItems = (a ? (weekNumber <= 1 ? a.firstWeek : a.ongoing) : []).filter(
    (i) => !(journey === 'PROMOTION' && PROMOTION_COVERS.includes(i.text))
  )
  const items = [...driverItems, ...stageItems, ...journeyItems, ...audienceItems]
  return audience ? items.filter((i) => !isSeniorOnly(i)) : items
}

// Journey items first, then the general menu: no duplicate types, no
// application tasks unless the stage is an active search.
export function shapePlan<T extends { text: string; actionType?: string }>(
  journey: JourneyType | null,
  stage: JourneyStage | null,
  weekNumber: number,
  general: T[],
  audience: PlanAudience = null,
  driver: MoveDriver | null = null,
  weeksInStage = 0,
  // What this member's real results and connections call for (engagement.ts):
  // the next unlock and, in a stalled search, what to try instead. Goes first.
  engagement: PlanItem[] = [],
  casual = false,
): (T | PlanItem)[] {
  // Casual searchers get a light plan and no application volume, until they are
  // actually interviewing or have an offer.
  const lightTouch = casual && (stage === 'PREPARING' || stage === 'APPLYING')
  const allowApply = (!stage || ACTIVE_SEARCH_STAGES.includes(stage)) && !lightTouch
  const out: (T | PlanItem)[] = []
  const types = new Set<string>()
  const texts = new Set<string>()
  for (const item of [...engagement, ...(lightTouch ? CASUAL_PLAN : []), ...journeyPlanItems(journey, stage, weekNumber, audience, driver), ...gateItems(stage, weeksInStage), ...general]) {
    if (audience && isSeniorOnly(item)) continue
    if (!allowApply && item.actionType && APPLICATION_ACTION_TYPES.includes(item.actionType)) continue
    if (item.actionType ? types.has(item.actionType) : texts.has(item.text)) continue
    if (item.actionType) types.add(item.actionType)
    texts.add(item.text)
    out.push(item)
  }
  return out
}
