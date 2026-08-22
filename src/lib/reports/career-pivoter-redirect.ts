// F-tier gap-reframing content — Market Reality Redesign Part 1, item 6.
// An F-band probability grade represents a real targeting mismatch, not a
// volume problem: more applications or more networking at the same target
// won't move a per-attempt probability this low. The standard "apply more/
// network more" framing is actively wrong here, so this content replaces it
// whenever the grade is F.
//
// Deliberately no LLM call — plain templated copy, same convention as
// narrative.ts's headline builder, so this redirect can never drift or
// invent a persona that doesn't fit the candidate reading it. No dedicated
// "Career Pivoter" feature existed anywhere in the codebase before this —
// only CandidateProfile.isPivoting, a plain boolean threaded as LLM-prompt
// context elsewhere. This is new, purpose-built content.
export interface GapReframingContent {
  headline: string
  body: string[]
}

export interface GapReframingCandidateInput {
  isPivoting: boolean
  primaryFunction: string | null
  targetRoleType: string | null
}

export function getGapReframingContent(
  probabilityGrade: string,
  candidate: GapReframingCandidateInput
): GapReframingContent | null {
  if (probabilityGrade !== 'F') return null

  const target = candidate.targetRoleType || candidate.primaryFunction || 'the role you named'

  const body: string[] = [
    `A grade this low means the gap between your background and "${target}" is real and structural — not something more applications or more outreach at the same target will close. This isn't a search-effort problem.`,
  ]

  if (candidate.isPivoting) {
    body.push(
      'You already flagged that you\'re pivoting — that\'s exactly the kind of change that can produce a read this low, and it\'s fixable by adjusting the target, not by pushing harder against this one.'
    )
  }

  body.push(
    'The highest-leverage move from here is reframing the target, not increasing volume: what from your background genuinely transfers, and what\'s the smallest adjacent role that bridges the gap between where you\'ve been and where you\'re aiming?'
  )

  return {
    headline: 'This is a targeting mismatch, not a volume problem.',
    body,
  }
}
