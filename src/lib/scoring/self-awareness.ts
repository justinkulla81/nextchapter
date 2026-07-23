// Self-awareness: does a candidate's self-report agree with independent
// evidence? Rule-based (not an LLM pass) — cheaper and explainable; can
// graduate to an LLM pass later if this misses too much.
//
// Leadership & Management, Communication & Collaboration, and Ownership &
// Reliability are the three categories with a real self-awareness check —
// each needs at least one completed reference as the independent evidence
// to compare against. Without one, the check returns 'not_available' (an
// honest "we can't tell yet," not a guessed match/mismatch) paired with a
// concrete unlock action, rather than silently omitting it or inferring
// from self-report alone.

import { CATEGORY_UNLOCK_ACTION, type CategoryKey, type SelfAwarenessRead } from '@/lib/scoring/grade'

export interface SelfAwarenessInputs {
  communicatorConfidence: number | null
  managementSkillConfidence: number | null
  isPeopleManager: boolean | null
  topStrengths: string[]
  dimensionVectors: Record<string, number> | null
  hasCompletedReference: boolean
}

// A self-rated confidence slider is 0-100 on a 4-stop scale; treat the top
// stop as "claims to be excellent" for mismatch purposes.
const HIGH_SELF_RATING_THRESHOLD = 90

// dimensionVectors lean toward each dimension's "low" pole when negative —
// a meaningfully negative leadership/communication vector is read as
// "reserved" for this comparison's purposes. This is the same
// unvalidated-heuristic tier as the rest of assessment-vectors.ts.
const LOW_POLE_THRESHOLD = -0.3

function checkLeadership(inputs: SelfAwarenessInputs): SelfAwarenessRead {
  if (!inputs.hasCompletedReference) {
    return { status: 'not_available', unlockAction: CATEGORY_UNLOCK_ACTION.leadership }
  }

  const claimsLeadership =
    inputs.topStrengths.includes('people_manager') || (inputs.managementSkillConfidence ?? 0) >= HIGH_SELF_RATING_THRESHOLD
  const leadershipVector = inputs.dimensionVectors?.leadership
  const structuredSignalWeak = inputs.isPeopleManager === false

  if (claimsLeadership && structuredSignalWeak) {
    return {
      status: 'mismatch',
      note: "Rates leadership highly and lists it as a top strength, but hasn't managed people directly.",
    }
  }
  if (claimsLeadership && leadershipVector !== undefined && leadershipVector < LOW_POLE_THRESHOLD) {
    return {
      status: 'mismatch',
      note: 'Rates leadership confidence highly, but How I Work Best results lean toward a more coaching, less directive style — worth a closer look, not necessarily a contradiction.',
    }
  }
  return { status: 'match' }
}

function checkCommunication(inputs: SelfAwarenessInputs): SelfAwarenessRead {
  if (!inputs.hasCompletedReference) {
    return { status: 'not_available', unlockAction: CATEGORY_UNLOCK_ACTION.communication }
  }

  const highSelfRating = (inputs.communicatorConfidence ?? 0) >= HIGH_SELF_RATING_THRESHOLD
  const communicationVector = inputs.dimensionVectors?.communication
  const noStrengthListed = !inputs.topStrengths.includes('communicator')

  if (highSelfRating && communicationVector !== undefined && communicationVector < LOW_POLE_THRESHOLD && noStrengthListed) {
    return {
      status: 'mismatch',
      note: 'Rates communication confidence highly, but How I Work Best results lean async/written and it isn\'t listed as a top strength — worth naming directly.',
    }
  }
  return { status: 'match' }
}

function checkOwnership(inputs: SelfAwarenessInputs): SelfAwarenessRead {
  // There's no good self-report proxy for reliability/follow-through — the
  // score itself already leans almost entirely on the reference rating, so
  // the self-awareness read here is really just "do we have a reference at
  // all yet," not a mismatch comparison.
  if (!inputs.hasCompletedReference) {
    return { status: 'not_available', unlockAction: CATEGORY_UNLOCK_ACTION.ownership }
  }
  return { status: 'match' }
}

export function getSelfAwarenessRead(
  category: CategoryKey,
  inputs: SelfAwarenessInputs
): SelfAwarenessRead | undefined {
  switch (category) {
    case 'leadership':
      return checkLeadership(inputs)
    case 'communication':
      return checkCommunication(inputs)
    case 'ownership':
      return checkOwnership(inputs)
    case 'targetFit':
    case 'skillsExecution':
    case 'adaptability':
      return undefined
  }
}
