// What the member said gets in the way, and what drives them, turned into two small changes they can see:
// the first step of their week, and the "why it matters" line on Home's one note. Pure.
//
// Blockers are practical constraints, never framed as problems with the person (see BLOCKER_OPTIONS).
// The question is multi-select with no ranking, so "the biggest" is the one whose first step helps
// soonest: money first, then the things that stall a search, then the things that slow it.

import type { JourneyType } from '@/lib/journey/journey'
import type { PlanItem } from '@/lib/journey/plan'

interface BlockerStep {
  /** The step, in plain words and small enough to finish this week. */
  text: string
  /** Reuses a task-menu action type when the work matches one, so detection and points keep working. */
  actionType?: string
  /** Why this is first, said back to the member. */
  because: string
}

const BLOCKER_STEPS: Record<string, BlockerStep> = {
  financial_pressure: {
    text: 'Check which benefits and bridge income you qualify for',
    because: 'You said money limits how picky you can be. Knowing your options first takes the pressure down.',
  },
  discouragement_tendency: {
    text: 'Pick one small win for today and finish it',
    because: 'You said it is easy to stall out. A small finished thing builds the next one.',
  },
  procrastination_tendency: {
    text: 'Set a 20-minute timer and start with the easiest application',
    because: 'You said starting is the hard part. Twenty minutes is easier to begin than a whole task.',
  },
  networking_discomfort: {
    text: 'Send one short message to someone who already likes you',
    actionType: 'OUTREACH_MESSAGE',
    because: 'You said networking is uncomfortable. Starting with a friendly face is the easiest first message.',
  },
  search_embarrassment: {
    text: 'Write one sentence you are comfortable saying about where you are',
    because: 'You said it feels awkward. Having one calm sentence ready makes every conversation easier.',
  },
  career_clarity: {
    text: 'Look at three roles close to yours and note what you like in each',
    because: 'You said you are not sure what you want next. Comparing real roles beats guessing.',
  },
  dead_end_feeling: {
    text: 'See other roles you could do with the skills you already have',
    because: 'You said your current path feels like a dead end. Seeing other roles shows there are more doors.',
  },
  family_caregiving: {
    text: 'Block two protected hours this week for your search',
    because: 'You said life outside work takes time. Two fixed hours are more reliable than finding time.',
  },
}

// Which blocker leads when several are chosen.
const BLOCKER_PRIORITY = [
  'financial_pressure',
  'discouragement_tendency',
  'procrastination_tendency',
  'networking_discomfort',
  'search_embarrassment',
  'career_clarity',
  'dead_end_feeling',
  'family_caregiving',
] as const

// Journeys where we do not push a search task at all.
const GENTLE_JOURNEYS: JourneyType[] = ['TIME_OFF', 'ENTREPRENEUR', 'FRACTIONAL']

export interface BlockerPick {
  item: PlanItem
  because: string
}

/** The first step of the week for the biggest blocker, or null when nothing applies. */
export function blockerStep(blockers: readonly string[], journey?: JourneyType | null): BlockerPick | null {
  if (journey && GENTLE_JOURNEYS.includes(journey)) return null
  const lead = BLOCKER_PRIORITY.find((b) => blockers.includes(b))
  if (!lead) return null
  const s = BLOCKER_STEPS[lead]
  return { item: { text: s.text, actionType: s.actionType }, because: s.because }
}

/** Puts the blocker step first, once. Leaves the plan alone when there is no blocker to answer. */
export function withBlockerStep(plan: PlanItem[], blockers: readonly string[], journey?: JourneyType | null): { plan: PlanItem[]; because: string | null } {
  const pick = blockerStep(blockers, journey)
  if (!pick) return { plan, because: null }
  const rest = plan.filter((p) => p.text !== pick.item.text)
  return { plan: [pick.item, ...rest], because: pick.because }
}

// What drives them, said as the end of a "why it matters" sentence. The first one chosen leads.
const MOTIVATION_LINES: Record<string, string> = {
  provide_for_family: 'brings you closer to providing for your family',
  prove_myself_again: 'is another proof of what you can do',
  regain_identity_purpose: 'moves you back toward work that feels like you',
  financial_stability: 'moves you toward steadier ground',
  intellectual_challenge: 'moves you toward work that challenges you',
  make_an_impact: 'moves you toward work that makes a difference',
}

/** "This week, one step ..." style line for the note, or null when they have not said. */
export function motivationLine(motivations: readonly string[]): string | null {
  const first = motivations.find((m) => MOTIVATION_LINES[m])
  return first ? MOTIVATION_LINES[first] : null
}

/** Adds what drives them to the note's reason. The original reason stays first and unchanged. */
export function noteWhyWithMotivation(why: string, motivations: readonly string[]): string {
  const line = motivationLine(motivations)
  if (!line) return why
  const base = why.trim().replace(/\.$/, '')
  return `${base}, and it ${line}.`
}
