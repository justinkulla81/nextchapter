// Search playbook: what to change as a search runs on, by journey. Pure and
// client-safe. The clock depends on why someone is moving: a member who was
// laid off counts weeks since their last day; everyone else counts weeks
// since they started applying. Nothing here assumes a member is out of work.
//
// Evidence lines quote the NextChapter White Collar Employment Report, September 2026
// (Version 1.72), and are shown only where they apply to that journey.

import type { JourneyStage, JourneyType } from '@prisma/client'
import { ACTIVE_SEARCH_STAGES } from './journey'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export interface PlaybookMilestone {
  atWeek: number
  title: string
  summary: string
  actions: { text: string; href?: string }[]
  evidence?: string
}

export type PlaybookBasis = 'SINCE_LAST_JOB' | 'SINCE_SEARCH_STARTED'

export interface PlaybookClock {
  weeks: number
  basis: PlaybookBasis
}

export interface PlaybookInput {
  journey: JourneyType | null
  stage: JourneyStage | null
  lastJobEndedAt: Date | null
  searchStartedAt: Date | null
  now: Date
}

function weeksBetween(from: Date, to: Date): number | null {
  const diff = to.getTime() - from.getTime()
  if (!Number.isFinite(diff) || diff < 0) return null
  return Math.floor(diff / MS_PER_WEEK)
}

// The member's search clock, or null when no search is running (exploring,
// preparing, landed, paused) so the card stays quiet instead of nagging.
export function searchClock(input: PlaybookInput): PlaybookClock | null {
  if (!input.journey || !input.stage) return null
  if (!ACTIVE_SEARCH_STAGES.includes(input.stage)) return null
  if (input.journey === 'LAID_OFF' && input.lastJobEndedAt) {
    const weeks = weeksBetween(input.lastJobEndedAt, input.now)
    if (weeks !== null) return { weeks, basis: 'SINCE_LAST_JOB' }
  }
  if (input.searchStartedAt) {
    const weeks = weeksBetween(input.searchStartedAt, input.now)
    if (weeks !== null) return { weeks, basis: 'SINCE_SEARCH_STARTED' }
  }
  return null
}

// Earliest moment the member moved into an active stage under their current
// journey. Falls back to the current stage change, then the first application.
export function pickSearchStart(args: {
  events: { toStage: JourneyStage | null; createdAt: Date }[]
  journeyChangedAt: Date | null
  journeyStageChangedAt: Date | null
  currentStageIsActive: boolean
  firstAppliedAt: Date | null
}): Date | null {
  const since = args.journeyChangedAt?.getTime() ?? 0
  const starts = args.events
    .filter((e) => e.toStage && ACTIVE_SEARCH_STAGES.includes(e.toStage) && e.createdAt.getTime() >= since)
    .map((e) => e.createdAt.getTime())
  if (starts.length) return new Date(Math.min(...starts))
  if (args.currentStageIsActive && args.journeyStageChangedAt) return args.journeyStageChangedAt
  return args.firstAppliedAt
}

const LAID_OFF: PlaybookMilestone[] = [
  {
    atWeek: 4,
    title: 'Weeks 4 to 11: build conversations, not only applications',
    summary: 'The first month is for setting up. From here, the people you talk to find more roles than the boards do.',
    actions: [
      { text: 'Aim for five conversations a week with people who know your work.' },
      { text: 'Tailor every application to its posting. Skip the ones you would not tailor.', href: '/dashboard/find-my-job' },
      { text: 'Check how long your savings and benefits last.', href: '/dashboard/benefits' },
    ],
    evidence: 'Job-tracker users who tailored their résumé got interviews from 4.2% of applications, against 2.1% for generic ones (Huntr, Q1 2026).',
  },
  {
    atWeek: 12,
    title: 'Week 12: change what you are doing',
    summary: 'Three months in, the same plan will give the same result. Widen the search and lean on referrals.',
    actions: [
      { text: 'Add one adjacent title and one adjacent industry to your targets.', href: '/dashboard/search-strategy' },
      { text: 'Ask every conversation for two introductions.' },
      { text: 'Move most of your week from applications to conversations and referrals.' },
    ],
    evidence: 'Two-thirds of offers among job-tracker users came within 50 applications, and interview rates fell as volume rose: 9.3% at 11 to 20 applications, 2.6% at 100 or more (Huntr, Q1 2026).',
  },
  {
    atWeek: 20,
    title: 'Week 20: open a second track',
    summary: 'Start work that pays or proves your value while the main search continues.',
    actions: [
      { text: 'Look at interim, fractional or contract work as a bridge.', href: '/dashboard/find-my-job?types=part_time,contract,advisory#independent-work' },
      { text: 'Check when unemployment benefits end and what you will do then.', href: '/dashboard/benefits' },
      { text: 'Re-check your pay expectations against current openings.' },
    ],
    evidence: 'Among unemployment insurance claimants, 39.3% used up their benefits in the 12 months to August 2026 (U.S. Department of Labor).',
  },
  {
    atWeek: 27,
    title: 'Week 27: you are in the long-term group, and that is not a personal failure',
    summary: '27 weeks is where the Bureau of Labor Statistics starts counting someone as long-term unemployed. More professionals are there than a year ago.',
    actions: [
      { text: 'Decide in writing what a step down in title or pay would have to look like for you to take it.' },
      { text: 'Ask your local American Job Center about training funds and re-employment services.' },
      { text: 'Talk to a coach about your search.', href: '/coaching' },
    ],
    evidence: '27.1% of all unemployed people had been out 27+ weeks in September 2026, up from 23.6% a year earlier (BLS). Among white-collar workers, 0.75% of the labor force was out 27+ weeks in January to August 2026, against 0.56% in 2025.',
  },
  {
    atWeek: 40,
    title: 'Week 40 and beyond: keep a rhythm and pick a direction',
    summary: 'A long search needs a routine you can keep, and a decision about where the next few months go.',
    actions: [
      { text: 'Keep a fixed weekly schedule: conversations, applications, learning, rest.' },
      { text: 'Choose whether to keep targeting your old level or to build toward a new field.', href: '/dashboard/learning' },
      { text: 'Review progress with your coach every two weeks.', href: '/coaching' },
    ],
    evidence: 'Of long-tenured workers displaced in 2023 to 2025, 66% were re-employed by January 2026, and about half of those earn less than before (BLS Displaced Worker Survey).',
  },
]

const READY_TO_MOVE: PlaybookMilestone[] = [
  {
    atWeek: 4,
    title: 'First month of searching: go through people',
    summary: 'You have a job, so you can be selective. Put your effort into warm routes at the companies you actually want.',
    actions: [
      { text: 'Name five target companies and one person you know at or near each.', href: '/dashboard/network' },
      { text: 'Keep your search confidential. Check that Confidential Search Mode is on.', href: '/dashboard/privacy' },
    ],
  },
  {
    atWeek: 8,
    title: 'Week 8: read your funnel',
    summary: 'Look at how many applications it takes to start a conversation, then fix the weakest step.',
    actions: [
      { text: 'Check your applications per conversation.', href: '/dashboard/find-my-job' },
      { text: 'If it is high, send fewer applications and tailor each one.' },
    ],
    evidence: 'Job-tracker users averaged about 24 applications per interview with a tailored résumé and about 48 without one (Huntr, Q1 2026).',
  },
  {
    atWeek: 12,
    title: 'Week 12: widen or sharpen',
    summary: 'If you are not getting conversations, the targeting is off. If you are getting them but no offers, the pitch is.',
    actions: [
      { text: 'Widen by location, remote work or one adjacent title.', href: '/dashboard/search-strategy' },
      { text: 'Check your pay expectations against what is being posted.' },
    ],
    evidence: 'People who changed jobs received 5.0% raises, against 3.6% for those who stayed (Atlanta Fed, cited in the September 2026 report).',
  },
  {
    atWeek: 20,
    title: 'Week 20: decide whether to keep going now',
    summary: 'Staying can be the right call. Choose it on purpose and set a date to look again.',
    actions: [
      { text: 'Pause the search with a date to revisit, or raise a stretch role at your current employer.' },
      { text: 'Use any offers you do have to test your current pay.' },
    ],
  },
]

const PROMOTION: PlaybookMilestone[] = [
  {
    atWeek: 4,
    title: 'Build the case',
    summary: 'A promotion is easier to grant when you have done the work of making it easy.',
    actions: [
      { text: 'Write a one-page summary of your impact with numbers.' },
      { text: 'List what the next level does that you already do.' },
    ],
  },
  {
    atWeek: 8,
    title: 'Know your number',
    summary: 'Arrive with a market range and a reason, not a feeling.',
    actions: [
      { text: 'Look up the market range for the next level and practice the conversation.', href: '/dashboard/find-my-job' },
      { text: 'Schedule the conversation with your manager.' },
    ],
    evidence: 'People who changed jobs received 5.0% raises, against 3.6% for those who stayed (Atlanta Fed, cited in the September 2026 report).',
  },
  {
    atWeek: 12,
    title: 'Make the ask and get a timeline',
    summary: 'If you have not asked yet, ask now. Get the next step and a date in writing.',
    actions: [
      { text: 'Ask what it would take, by when, and who decides.' },
      { text: 'Follow up in writing the same day.' },
    ],
  },
  {
    atWeek: 20,
    title: 'No movement? Test the market',
    summary: 'An outside offer, or just an outside conversation, tells you what you are worth and gives you leverage.',
    actions: [
      { text: 'Interview for two roles at the next level outside your company.', href: '/dashboard/find-my-job' },
      { text: 'If you get an offer, compare it before you talk to your manager.', href: '/dashboard/find-my-job' },
    ],
  },
]

const CAREER_CHANGE: PlaybookMilestone[] = [
  {
    atWeek: 4,
    title: 'Name the target and the gap',
    summary: 'A pivot with one clear target is easier to explain than a pivot to "something different".',
    actions: [
      { text: 'Pick one target function and list three things you have done that transfer.', href: '/dashboard/search-strategy' },
      { text: 'Check how that field has been moving.', href: '/dashboard/learning' },
    ],
  },
  {
    atWeek: 12,
    title: 'Produce proof and have the conversations',
    summary: 'People in the new field want to see that you can do the work, and they want to meet you first.',
    actions: [
      { text: 'Finish one small project or credential you can show.', href: '/dashboard/learning' },
      { text: 'Talk to ten people who do the job now.' },
    ],
    evidence: 'About half of displaced full-time workers who found work again earn less than before. A bigger change often means re-entering a level lower (BLS Displaced Worker Survey).',
  },
  {
    atWeek: 20,
    title: 'Test a bridge role',
    summary: 'A contract, fractional or adjacent role can move you across faster than waiting for the perfect one.',
    actions: [
      { text: 'Look for contract, interim or adjacent roles that touch the new field.', href: '/dashboard/find-my-job?types=part_time,contract,advisory#independent-work' },
      { text: 'Decide what title and pay you will accept to get in.' },
    ],
  },
  {
    atWeek: 30,
    title: 'Review the pivot',
    summary: 'If you are not getting conversations in the new field, move the target one step closer to what you have done.',
    actions: [{ text: 'Pick a nearer adjacent target and keep the proof you built.', href: '/dashboard/search-strategy' }],
  },
]

const RETURNING: PlaybookMilestone[] = [
  {
    atWeek: 4,
    title: 'Tell the gap in two sentences',
    summary: 'Say what happened, what you did, and what you are ready for. Then move on.',
    actions: [
      { text: 'Write and practice the two sentences.' },
      { text: 'Reconnect with five former colleagues.', href: '/dashboard/network' },
    ],
  },
  {
    atWeek: 8,
    title: 'Refresh and prove',
    summary: 'One current skill and one recent piece of work change how the gap reads.',
    actions: [
      { text: 'Pick one tool or skill to refresh, including AI tools.', href: '/dashboard/learning' },
      { text: 'Add one recent project, volunteer role or course to your Dossier.', href: '/dashboard/portfolio' },
    ],
  },
  {
    atWeek: 12,
    title: 'Aim at employers who hire returners',
    summary: 'Returnship programs, contract-to-hire and project roles are built for this.',
    actions: [{ text: 'Look at returnship programs and contract-to-hire roles.', href: '/dashboard/find-my-job' }],
    evidence: 'Returnship programs continue at large employers, but the report found no reliable 2026 count.',
  },
  {
    atWeek: 20,
    title: 'Widen the way back in',
    summary: 'Part-time, contract or fractional work can be the first step to a full-time role.',
    actions: [{ text: 'Consider part-time or fractional work as a first step.', href: '/dashboard/find-my-job?types=part_time,contract,advisory#independent-work' }],
  },
]

const NEXT_ACT: PlaybookMilestone[] = [
  {
    atWeek: 8,
    title: 'Define the offer',
    summary: 'Board, fractional and consulting work sell on a clear, narrow offer.',
    actions: [{ text: 'Write one sentence on who you help and with what.', href: '/dashboard/portfolio' }],
  },
  {
    atWeek: 16,
    title: 'Have the conversations',
    summary: 'Most of this work comes from people who already know you.',
    actions: [{ text: 'Talk to ten people who could hire you or refer you.', href: '/dashboard/network' }],
  },
  {
    atWeek: 24,
    title: 'Land a first engagement',
    summary: 'A small paid or advisory engagement beats another month of planning.',
    actions: [{ text: 'Offer a scoped first engagement to your warmest contact.' }],
  },
]

// Students and new grads: campus recruiting runs early, most first jobs come
// through people, and a first offer is negotiable. No claim here leans on
// figures the September report does not carry.
const STUDENT_NEW_GRAD: PlaybookMilestone[] = [
  {
    atWeek: 2,
    title: 'Aim before you apply',
    summary: 'Two or three target roles make every résumé line and application sharper than a hundred scattershot ones.',
    actions: [
      { text: 'Pick two or three target roles from your major.', href: '/dashboard/early-career#roles' },
      { text: 'Track 10 employers you would like to work for.', href: '/dashboard/companies' },
    ],
  },
  {
    atWeek: 4,
    title: 'Talk to people, not only portals',
    summary: 'Most first jobs come through someone. Alumni are the people most likely to say yes to a 20-minute call.',
    actions: [
      { text: 'Ask three alumni for an informational interview.', href: '/dashboard/groups' },
      { text: 'Ask each one who else you should talk to.' },
    ],
  },
  {
    atWeek: 8,
    title: 'Practice the interview you will get',
    summary: 'Entry-level interviews test how you think and work with people: behavioral, case and technical questions.',
    actions: [{ text: 'Do two mock interviews for your target role.', href: '/dashboard/interview-prep' }],
  },
  {
    atWeek: 12,
    title: 'No interviews yet? Widen the door',
    summary: 'Rotational programs, contract-to-hire and roles one step adjacent to your target are real ways in. Internships are listed in your college’s NextChapter portal.',
    actions: [
      { text: 'Look at entry-level roles near your target.', href: '/dashboard/find-my-job?seniority=ENTRY_LEVEL' },
      { text: 'Have someone in the field read your résumé.', href: '/dashboard/resume' },
    ],
  },
  {
    atWeek: 20,
    title: 'Keep a skill moving while you search',
    summary: 'One finished course or project you can talk about keeps your story current and gives you something new to say.',
    actions: [{ text: 'Finish one free course your target role asks for.', href: '/dashboard/learning' }],
  },
]

export const PLAYBOOKS: Partial<Record<JourneyType, PlaybookMilestone[]>> = {
  STUDENT_NEW_GRAD,
  LAID_OFF,
  READY_TO_MOVE,
  EXPLORING_MOVE: READY_TO_MOVE,
  PROMOTION,
  CAREER_CHANGE,
  RETURNING,
  NEXT_ACT,
}

export interface PlaybookPosition {
  journey: JourneyType
  clock: PlaybookClock
  current: PlaybookMilestone | null
  next: PlaybookMilestone | null
  // The 27-week line applies to people who are out of work; flag it so the
  // card can use the "not a personal failure" message only where it is true.
  isLongTermUnemployed: boolean
}

export function playbookPosition(input: PlaybookInput): PlaybookPosition | null {
  const clock = searchClock(input)
  if (!clock || !input.journey) return null
  const list = PLAYBOOKS[input.journey]
  if (!list || list.length === 0) return null
  const passed = list.filter((m) => m.atWeek <= clock.weeks)
  const current = passed.length ? passed[passed.length - 1] : null
  const next = list.find((m) => m.atWeek > clock.weeks) ?? null
  return {
    journey: input.journey,
    clock,
    current,
    next,
    isLongTermUnemployed: input.journey === 'LAID_OFF' && clock.basis === 'SINCE_LAST_JOB' && clock.weeks >= 27,
  }
}
