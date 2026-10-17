// "Doors you could open": where a story could go from here, drawn as phases with ranges. Pure and
// client-safe. Built from the engines we already have (feasibility, pathway, ideas, the member's
// radar), so a door always comes from something the member said or something they already have.
//
// Rules: ranges, never a single date; a harder door is "a bigger door", never a warning; a
// starting point is a place to grow from; nothing here is a prediction or changes their search.

import { assessPivot, type PivotTier } from '@/lib/journey/feasibility'
import { FUNCTION_PROFILES, buildPathway, costText } from '@/lib/journey/pathway'
import { functionIdeas, type FunctionIdea, type IdeasInput } from '@/lib/journey/pivot-ideas'
import { stanceOf, type PivotTarget } from '@/lib/journey/pivot'
import type { CareerDetails } from '@/lib/journey/career'
import type { Relocation } from '@/lib/journey/relocation'
import { describeRelocation } from '@/lib/journey/relocation'

export const DOOR_SCALE_MONTHS = 36

export type DoorPhase = { label: string; from: number; solidTo: number; rangeTo: number }
export type DoorKind = 'GROW' | 'FUNCTION' | 'VENTURE' | 'SCHOOL' | 'MOVE' | 'PAUSE' | 'FRACTIONAL'

export type Door = {
  id: string
  kind: DoorKind
  tag: string
  tagTone: 'green' | 'blue' | 'warm' | 'neutral'
  title: string
  why: string
  firstStep: string
  cost: string | null
  phases: DoorPhase[]
  opens: string[]
  // The function to put on the radar, for a door into another field.
  radarFunction: string | null
  onRadar: boolean
}

const clip = (n: number) => Math.min(n, DOOR_SCALE_MONTHS)
const phase = (label: string, from: number, solidTo: number, rangeTo: number): DoorPhase => ({ label, from: clip(from), solidTo: clip(solidTo), rangeTo: clip(rangeTo) })

export function phasesForTier(tier: PivotTier, months: [number, number] | null): DoorPhase[] {
  if (tier === 'ADJACENT' || !months) {
    return [phase('Talk to people', 0, 1.5, 2), phase('A short course', 2, 3.5, 5), phase('Apply', 4, 8, 12)]
  }
  const [lo, hi] = months
  return [
    phase('Try it out', 0, 2, 3),
    phase('Learn and build proof', 2, 2 + lo, 2 + hi),
    phase('A first role to grow from', 2 + lo, 2 + lo + 6, 2 + hi + 6),
  ]
}

const TAGS: Record<string, { tag: string; tone: Door['tagTone'] }> = {
  ADJACENT: { tag: 'A natural move', tone: 'blue' },
  BRIDGE: { tag: 'Possible with some learning', tone: 'blue' },
  REBUILD: { tag: 'A bigger door', tone: 'warm' },
  LICENSED: { tag: 'A bigger door', tone: 'warm' },
}

function functionDoor(fn: string, why: string, firstStep: string, from: string | null, opts: { seniorLevel: boolean; ownedFunctions: string[]; keywords: string[]; onRadar: boolean }): Door | null {
  const a = assessPivot(from, fn, { seniorLevel: opts.seniorLevel, ownedFunctions: opts.ownedFunctions })
  const profile = FUNCTION_PROFILES[fn]
  const path = buildPathway(from, fn, { keywords: opts.keywords, seniorLevel: opts.seniorLevel, ownedFunctions: opts.ownedFunctions })
  if (!profile || !path || a.tier === 'SAME' || a.tier === 'LEVEL_GATED') return null
  const tag = TAGS[a.tier] ?? TAGS.BRIDGE
  const range = a.tier === 'ADJACENT' ? 'Often little or nothing.' : `Roughly ${costText({ low: path.cost.INFORMAL.low, high: path.cost.FORMAL.high, what: '' }).replace('Up to ', 'up to ')}, depending on the route.`
  return {
    id: `fn:${fn}`,
    kind: 'FUNCTION',
    tag: tag.tag,
    tagTone: tag.tone,
    title: fn,
    why,
    firstStep,
    cost: range,
    phases: phasesForTier(a.tier, a.months),
    opens: profile.entryRoles,
    radarFunction: fn,
    onRadar: opts.onRadar,
  }
}

const STANCE_ORDER = { GOING_FOR_IT: 0, PREPARING: 1, TRYING: 2, WONDERING: 3, SET_ASIDE: 9 } as const
const TIER_RANK: Record<PivotTier, number> = { SAME: 0, ADJACENT: 1, BRIDGE: 2, REBUILD: 3, LICENSED: 4, LEVEL_GATED: 5 }

export type DoorsInput = IdeasInput & {
  radar: PivotTarget[]
  career: CareerDetails | null
  relocation: Relocation
}

export function buildDoors(input: DoorsInput): { main: Door[]; more: Door[] } {
  const from = input.from
  const opts = { seniorLevel: input.seniorLevel, ownedFunctions: input.ownedFunctions, keywords: input.keywords }

  const grow: Door = {
    id: 'grow',
    kind: 'GROW',
    tag: 'Grow where you are',
    tagTone: 'green',
    title: input.career?.nextLevel ?? `The next level in ${from ?? 'your field'}`,
    why: `A step up${from ? ` in ${from}` : ''} is mostly proof: results, scope and a sponsor. You may already have more than you think.`,
    firstStep: 'Ask your manager what the next level needs, in writing.',
    cost: 'No training cost. A course is optional.',
    phases: [phase('Build the case', 0, 3, 6), phase('Step up', 6, 12, 24), phase('Lead', 24, 30, 36)],
    opens: [input.career?.nextLevel ?? 'The next level', 'Wider scope', 'Advisory or fractional work'],
    radarFunction: null,
    onRadar: false,
  }

  // Fields on their radar come first, in order of how far along they are; then fields that fit.
  const radar = input.radar.filter((t) => stanceOf(t) !== 'SET_ASIDE').sort((a, b) => STANCE_ORDER[stanceOf(a)] - STANCE_ORDER[stanceOf(b)])
  const candidates: Door[] = []
  for (const t of radar) {
    const d = functionDoor(t.function, `You put ${t.function} on your radar.`, `Talk to one person who does ${t.function} work and ask what a normal week looks like.`, from, { ...opts, onRadar: true })
    if (d) candidates.push(d)
  }
  const ideas: FunctionIdea[] = functionIdeas({ ...input, onRadar: radar.map((t) => t.function) }, 6)
  for (const idea of ideas) {
    const d = functionDoor(idea.function, idea.why, idea.smallestStep, from, { ...opts, onRadar: false })
    if (d) candidates.push(d)
  }
  const rank = (d: Door) => TIER_RANK[assessPivot(from, d.title, { seniorLevel: input.seniorLevel, ownedFunctions: input.ownedFunctions }).tier]
  const fnDoors: Door[] = []
  if (candidates.length) {
    const nearest = [...candidates].sort((a, b) => rank(a) - rank(b))[0]
    fnDoors.push(nearest)
    // A second door that shows the range: a bigger one when there is one, else the next nearest.
    const rest = candidates.filter((c) => c.id !== nearest.id)
    const bigger = rest.find((c) => rank(c) > rank(nearest)) ?? rest[0]
    if (bigger) fnDoors.push(bigger)
  }

  const more: Door[] = [
    {
      id: 'venture', kind: 'VENTURE', tag: 'Your own thing', tagTone: 'warm', title: 'Start your own practice',
      why: 'Many people turn what they know into a practice of their own, often alongside a job at first.',
      firstStep: 'Talk to five people who might be your first customers and ask what they struggle with.',
      cost: 'Costs vary a lot. We will help you sketch yours.',
      phases: [phase('Test the idea', 0, 2, 3), phase('First customers', 3, 6, 12), phase('A steady rhythm', 6, 12, 24)],
      opens: ['Your own practice', 'Fractional work', 'Advisory roles'], radarFunction: null, onRadar: false,
    },
    {
      id: 'school', kind: 'SCHOOL', tag: 'Go back to school', tagTone: 'blue', title: 'Go back to school',
      why: 'A certificate or a degree can open a field, change your level, or just be something you want to do.',
      firstStep: 'List two programs and ask a graduate of each what changed for them.',
      cost: 'Certificates often run $1,000 to $10,000. Graduate programs usually cost much more.',
      phases: [phase('Choose a program', 0, 3, 6), phase('Study, often part time', 6, 18, 36), phase('Back to work with something new', 18, 24, 36)],
      opens: ['A new field', 'A higher level', 'A credential employers ask for'], radarFunction: null, onRadar: false,
    },
    {
      id: 'move', kind: 'MOVE', tag: 'A new place', tagTone: 'blue', title: 'Move to a new city',
      why: `You said you would consider ${describeRelocation(input.relocation)}.`,
      firstStep: input.relocation.scope === 'STATES' ? 'Look at roles in the states you named.' : 'Pick two places and look at who is hiring there.',
      cost: null,
      phases: [phase('Pick places', 0, 1, 2), phase('Line up work', 1, 6, 9), phase('Make the move', 6, 9, 12)],
      opens: ['A bigger market', 'A lower cost of living', 'Being near people you love'], radarFunction: null, onRadar: false,
    },
    {
      id: 'fractional', kind: 'FRACTIONAL', tag: 'On your own terms', tagTone: 'warm', title: `${from ?? 'Your function'} as fractional work`,
      why: 'More control over your time and your clients, using the experience you already have.',
      firstStep: 'Write one line: who you help and the result you deliver.',
      cost: 'Little to start. A day rate and a few conversations.',
      phases: [phase('Define your offer', 0, 1, 2), phase('A first client', 1, 4, 8), phase('A steady pipeline', 4, 12, 18)],
      opens: ['Fractional engagements', 'Advisory roles', 'A portfolio of clients'], radarFunction: null, onRadar: false,
    },
    {
      id: 'pause', kind: 'PAUSE', tag: 'Rest or reset', tagTone: 'neutral', title: 'Take a pause',
      why: 'For family, health, rest, a move or a venture. Try it on to see how it would line up.',
      firstStep: 'Work out how many months of expenses you have saved.',
      cost: null,
      phases: [phase('Line things up', 0, 2, 3), phase('The pause itself', 3, 6, 12), phase('Ease back in', 6, 9, 15)],
      opens: ['Rest', 'Time for what matters', 'A fresh start'], radarFunction: null, onRadar: false,
    },
  ]
  return { main: [grow, ...fnDoors].slice(0, 3), more }
}
