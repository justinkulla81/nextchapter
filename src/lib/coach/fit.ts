import { coachMatchesSeniority } from '@/lib/scoring/level-rank'
import { COACHING_STYLE_LABEL, styleFit, type CoachingStyle } from '@/lib/coach/coaching-style'

// How well a coach fits a member, and WHY, in terms the member recognises. Pure — no
// database — so every rule is tested (src/test/coach-fit.test.ts).
//
// Quality/grade signals are deliberately absent: a coach's position can never be
// influenced by how "easy" a member looks (see the invariant in matching.ts).

export interface FitMember {
  primaryFunction: string | null
  secondaryFunction: string | null
  /** Current + secondary + target industries. */
  industries: string[]
  /** Calibrated seniority score, or null when unknown. */
  levelRankScore: number | null
  /** Skills the member wants to build or is missing. */
  skillsWanted: string[]
  /** The styles the member wants most (assessment). */
  styleTop: CoachingStyle[]
  lowSentiment: boolean
}

export interface FitCoach {
  functions: string[]
  industries: string[]
  seniorityFit: string[]
  skills: string[]
  coachingStyles: string[]
  specializationTags: string[]
}

export interface FitWeights {
  function: number
  industry: number
  seniority: number
  skill: number
  style: number
  highNeed: number
}

export interface CoachFit {
  score: number
  /** Plain-language reasons, best first, in the member's terms. */
  reasons: string[]
}

const HIGH_NEED_TAG = 'comfort_with_high_need_candidates'
const MAX_SKILL_MATCHES = 2

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const overlaps = (a: string, b: string) => {
  const x = norm(a)
  const y = norm(b)
  return x.length > 0 && y.length > 0 && (x === y || x.includes(y) || y.includes(x))
}
const firstMatch = (wanted: (string | null)[], have: string[]) =>
  wanted.find((w): w is string => !!w && have.some((h) => overlaps(w, h))) ?? null

export function scoreCoachFit(member: FitMember, coach: FitCoach, w: FitWeights): CoachFit {
  let score = 0
  const reasons: { points: number; text: string }[] = []

  // Style first: it is the most personal signal, and what the member explicitly asked for.
  const style = styleFit(member.styleTop, coach.coachingStyles)
  if (style.overlap > 0) {
    const pts = style.overlap * w.style
    score += pts
    const wanted = style.matched.map((m) => COACHING_STYLE_LABEL[m].charAt(0).toLowerCase() + COACHING_STYLE_LABEL[m].slice(1))
    reasons.push({ points: pts, text: `Matches what you asked for: a coach who ${wanted.join(' and ').replace(/ me\b/g, ' you').replace(/\bmy\b/g, 'your')}` })
  }

  // Function: an explicit coach function list, falling back to the old convention of a
  // function name typed into "industries" so existing coaches keep matching.
  const fn = firstMatch([member.primaryFunction, member.secondaryFunction], [...coach.functions, ...coach.industries])
  if (fn) {
    score += w.function
    reasons.push({ points: w.function, text: `Coaches ${fn} leaders` })
  }

  const ind = firstMatch(member.industries, coach.industries)
  if (ind) {
    score += w.industry
    reasons.push({ points: w.industry, text: `Has coached in ${ind}` })
  }

  if (member.levelRankScore !== null && coachMatchesSeniority(coach.seniorityFit, member.levelRankScore)) {
    score += w.seniority
    reasons.push({ points: w.seniority, text: 'Works with people at your level' })
  }

  const skillHits = member.skillsWanted.filter((s) => coach.skills.some((c) => overlaps(s, c))).slice(0, MAX_SKILL_MATCHES)
  if (skillHits.length > 0) {
    const pts = skillHits.length * w.skill
    score += pts
    reasons.push({ points: pts, text: `Strong in ${skillHits.join(' and ')}, which you want to build` })
  }

  // Never shown as a flag to the coach, only reflected in ranking (existing behaviour).
  if (member.lowSentiment && coach.specializationTags.includes(HIGH_NEED_TAG)) {
    score += w.highNeed
  }

  return { score, reasons: reasons.sort((a, b) => b.points - a.points).map((r) => r.text) }
}
