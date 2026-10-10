// What a member wants FROM a coach, and what a coach delivers — the "personality" side
// of coach matching. Pure (no database), tested in src/test/coaching-style.test.ts.
//
// Six styles, deliberately plain, each something a person can say "yes, that's what I
// need" about. A member answers a short set of statements (1-4 each); the two
// dimensions they rate highest are what they want. A coach states the styles they
// actually deliver. Matching rewards overlap and says why, in the member's own words.

export const COACHING_STYLES = ['PUSH', 'SUPPORT', 'ACCOUNTABILITY', 'STRATEGY', 'PRACTICAL', 'SPACE'] as const
export type CoachingStyle = (typeof COACHING_STYLES)[number]

export const COACHING_STYLE_LABEL: Record<CoachingStyle, string> = {
  PUSH: 'Pushes me',
  SUPPORT: 'Supports me',
  ACCOUNTABILITY: 'Holds me accountable',
  STRATEGY: 'Thinks it through with me',
  PRACTICAL: 'Gives me practical steps',
  SPACE: 'Listens and lets me process',
}

/** How a coach describes the same thing about themselves. */
export const COACHING_STYLE_COACH_LABEL: Record<CoachingStyle, string> = {
  PUSH: 'Challenges and stretches clients',
  SUPPORT: 'Encourages and builds confidence',
  ACCOUNTABILITY: 'Tracks commitments and follows up',
  STRATEGY: 'Works through options and trade-offs',
  PRACTICAL: 'Gives concrete steps, scripts and templates',
  SPACE: 'Listens and lets clients process',
}

export interface StyleItem {
  id: string
  style: CoachingStyle
  text: string
}

// Two statements per style, worded as the member's own wish. Rated 1 (not like me)
// to 4 (very like me).
export const COACHING_STYLE_ITEMS: StyleItem[] = [
  { id: 'push-1', style: 'PUSH', text: 'I want a coach who will tell me when I am aiming too low.' },
  { id: 'push-2', style: 'PUSH', text: 'I do my best work when someone challenges my excuses.' },
  { id: 'support-1', style: 'SUPPORT', text: 'I want a coach who builds my confidence when this gets discouraging.' },
  { id: 'support-2', style: 'SUPPORT', text: 'It matters to me that my coach is warm and encouraging.' },
  { id: 'accountability-1', style: 'ACCOUNTABILITY', text: 'I want someone to check in on whether I did what I said I would.' },
  { id: 'accountability-2', style: 'ACCOUNTABILITY', text: 'Deadlines and follow-ups from a coach keep me moving.' },
  { id: 'strategy-1', style: 'STRATEGY', text: 'I want to work through my options and trade-offs with someone.' },
  { id: 'strategy-2', style: 'STRATEGY', text: 'I value a coach who helps me see the bigger picture.' },
  { id: 'practical-1', style: 'PRACTICAL', text: 'I want concrete next steps, scripts and templates, not just discussion.' },
  { id: 'practical-2', style: 'PRACTICAL', text: 'I would rather be told exactly what to do this week.' },
  { id: 'space-1', style: 'SPACE', text: 'I want a coach who listens and lets me think out loud.' },
  { id: 'space-2', style: 'SPACE', text: 'I need room to process before I decide what to do.' },
]

export type StyleRatings = Record<string, number>

export interface StyleResult {
  /** Mean rating per style, 1-4. Null when neither of its items was answered. */
  scores: Record<CoachingStyle, number | null>
  /** The styles the member wants most, strongest first. At most two; none if they rated everything alike. */
  top: CoachingStyle[]
}

const VALID = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 4

export function scoreCoachingStyle(ratings: StyleRatings): StyleResult {
  const scores = {} as Record<CoachingStyle, number | null>
  for (const style of COACHING_STYLES) {
    const vals = COACHING_STYLE_ITEMS.filter((i) => i.style === style).map((i) => ratings[i.id]).filter(VALID)
    scores[style] = vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length
  }
  const ranked = COACHING_STYLES.filter((s) => scores[s] !== null)
    .map((s) => ({ s, v: scores[s] as number }))
    .sort((a, b) => b.v - a.v)
  if (ranked.length === 0) return { scores, top: [] }

  // Someone who rated every statement the same expressed no preference; do not invent one.
  const max = ranked[0].v
  const min = ranked[ranked.length - 1].v
  if (ranked.length >= 2 && max === min) return { scores, top: [] }

  // Top two, but only styles they actually rated as a real "yes" (3 or more).
  return { scores, top: ranked.filter((r) => r.v >= 3).slice(0, 2).map((r) => r.s) }
}

export function isCoachingStyle(value: unknown): value is CoachingStyle {
  return typeof value === 'string' && (COACHING_STYLES as readonly string[]).includes(value)
}

export interface StyleFit {
  /** 0, 1 or 2: how many of the member's wanted styles this coach delivers. */
  overlap: number
  matched: CoachingStyle[]
}

export function styleFit(memberTop: CoachingStyle[], coachStyles: string[]): StyleFit {
  const delivered = new Set(coachStyles.filter(isCoachingStyle))
  const matched = memberTop.filter((s) => delivered.has(s))
  return { overlap: matched.length, matched }
}
