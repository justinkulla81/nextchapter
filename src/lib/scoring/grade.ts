// Pure types/values for the single Current Market Reality — no server-only
// dependencies, so client components (e.g. the animated score-reveal ring)
// can import these directly without pulling in the Prisma/market-data
// computation in dossier-competencies.ts.
//
// Scoring Model 2.0: there is one grade, built from six categories (Target
// Fit plus five hiring-manager competency categories) and a weekly-effort
// nudge. There is no longer a separate "Search Action Grade" — weekly
// effort is an input to the one grade, not a second grade of its own.

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

// Deliberately hard grading — most candidates should land on C, with A and
// F reserved for real extremes (see GRADE_BAND_DESCRIPTION and the "we're
// hard graders" copy in GradeSystemExplainer). This is a first-pass curve,
// not fit to real usage data — this product has too few real scored
// candidates yet to calibrate against an actual distribution; revisit once
// there's a meaningful population to check it against, and once there's
// real data on how the new baseline+weekly-nudge formula actually moves
// scores week to week.
export function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'F'
}

export const GRADE_LABEL: Record<Grade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Average',
  D: 'Needs work',
  F: 'Critical gap',
}

// Deliberately no raw numbers shown anywhere in the product — a number
// like "62/100" reads as more precise than the underlying signals actually
// are. The letter grade plus this band description is the whole story.
//
// We're hard graders on purpose — see GradeSystemExplainer for the full
// explanation. Most candidates land on C; that's the honest, expected
// result, not a failure. A and F are reserved for real extremes.
export const GRADE_BAND_DESCRIPTION: Record<Grade, string> = {
  A: "Excellent — you'll likely move fast. This is rare, and it means almost everything here is already working in your favor.",
  B: 'Good — a real strength, with a bit more sharpening to reach the top tier.',
  C: "You have some good stuff going, but it's clearly not working the way it needs to yet — this takes real, focused work to fix. Most candidates land here.",
  D: 'Needs work — this is actively holding you back, and it needs attention before the rest of your search can gain traction.',
  F: 'Critical gap — a major weakness or missing piece here is the single highest-leverage thing to fix first.',
}

// What a recruiter looking at this candidate's material would conclude —
// framed from the recruiter's side, not the candidate's own search-speed
// framing GRADE_BAND_DESCRIPTION above gives. Used for Victoria's opening
// line on the onboarding score-reveal screen (/onboarding/score).
export const GRADE_RECRUITER_IMPRESSION: Record<Grade, string> = {
  A: 'recruiters will see far more strengths than weaknesses.',
  B: 'recruiters will see mostly strengths, with only a few things to sharpen.',
  C: 'recruiters will find real strengths and real weaknesses — a genuinely mixed picture.',
  D: 'recruiters will find more weaknesses than strengths.',
  F: "recruiters will find weaknesses serious enough to end most conversations before they start.",
}

// Directional estimates, not a calibrated statistic — same "first pass,
// not fit to real usage data" caveat as scoreToGrade's own bands above.
// Shown under the grade legend so the letter grade translates into a real,
// concrete weekly target: both applications AND personalized outreach,
// together, not either one alone.
export const GRADE_INTERVIEW_ODDS: Record<Grade, string> = {
  A: 'Typically ~5-10 applications and 3-5 personalized outreach messages, per week, to land an interview.',
  B: 'Typically ~15-20 applications and 5-8 personalized outreach messages, per week, to land an interview.',
  C: 'Typically ~30-40 applications and 8-12 personalized outreach messages, per week, to land an interview.',
  D: 'Typically ~60-80 applications and 15-20 personalized outreach messages, per week, to land an interview.',
  F: 'Typically 100+ applications and 25+ personalized outreach messages, per week, to land an interview.',
}

// Shared color tokens for every grade display in the product — previously
// duplicated across DualGradeReveal, GradeSystemExplainer, DashboardTopStrip,
// and the market-reality page. One source of truth now.
export const GRADE_TEXT_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-warning',
  D: 'text-error',
  F: 'text-error',
}

// Ordinal position for plotting grades on a line/sparkline — never shown
// as a number itself, only used for y-axis position. Shared across every
// grade-trend chart so they can't silently drift out of sync.
export const GRADE_VALUE: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }

export const GRADE_RING_STROKE: Record<Grade, string> = {
  A: 'stroke-success',
  B: 'stroke-brand',
  C: 'stroke-warning',
  D: 'stroke-error',
  F: 'stroke-error',
}

// The six categories that make up the grade. Target Fit carries the old
// structural/market-condition signal (real hiring demand, how big a leap
// the target is, whether a specific target has been named, experience
// match) as a first-class, gradeable, improvable category — not a caveat
// label on the others. It stays in the score on purpose: someone
// reapplying to the same function in a market with plenty of open roles
// really is more market-ready than someone pivoting into a scarce one, and
// that's exactly what "Market Reality" means. The other five are
// hiring-manager competency categories, built mostly from the How I Work
// Best assessment, references, and resume data.
export type CategoryKey =
  | 'targetFit'
  | 'leadership'
  | 'skillsExecution'
  | 'communication'
  | 'adaptability'
  | 'ownership'

export const CATEGORY_ORDER: CategoryKey[] = [
  'targetFit',
  'leadership',
  'skillsExecution',
  'communication',
  'adaptability',
  'ownership',
]

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  targetFit: 'Target Fit',
  leadership: 'Leadership & Management',
  skillsExecution: 'Skills & Execution',
  communication: 'Communication & Collaboration',
  adaptability: 'Adaptability & Change Readiness',
  ownership: 'Ownership & Reliability',
}

export const CATEGORY_EXPLANATION: Record<CategoryKey, string> = {
  targetFit:
    "Is there real hiring demand for what you're targeting, and how well your background lines up with it. Unlike the categories below, this one reflects real market conditions as well as your own choices — but it's still improvable: a better-matched target, more location or function flexibility, or simply naming a specific target instead of staying flexible all move this.",
  leadership:
    "Whether you've actually led or managed at the scope you're describing — team size, cross-functional influence — and what references and your How I Work Best results say about how you lead.",
  skillsExecution:
    'Whether you can do the work and finish what you start — your How I Work Best results, your own confidence in your core skills, and any certifications or learning you\'ve logged.',
  communication:
    'Whether people can work with you and you explain yourself clearly — your own confidence, how clearly your resume communicates (readability and quantified results), and anything references say about it.',
  adaptability:
    "How you handle ambiguity and change, and — if you're pivoting — how realistic your expectations are about the change you're asking for.",
  ownership:
    "Whether people can hand you something and trust it gets done without hovering — your How I Work Best results and what references say about your follow-through.",
}

// Whether a candidate's self-report on a category agrees with harder
// evidence (a completed reference, or a How I Work Best result). Shown
// only where it's flattering on the Dossier; shown both directions in
// Coaching Notes and the Market Reality Report. 'not_available' — not a
// guessed pass — is used whenever the evidence needed to make the
// comparison doesn't exist yet (most commonly: no completed reference).
export type SelfAwarenessStatus = 'match' | 'mismatch' | 'not_available'

export interface SelfAwarenessRead {
  status: SelfAwarenessStatus
  note?: string
}

// How much real signal backs a category's grade today, separate from the
// grade itself — a candidate should be able to tell "this is confirmed by
// real data" apart from "this is our best guess so far." Improves as the
// candidate reveals more (references, job reactions, resume/LinkedIn
// completion, etc.), independent of whether the grade itself goes up or
// down.
export type ConfidenceLevel = 'HIGH' | 'BUILDING' | 'PROVISIONAL'

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  HIGH: 'Confirmed',
  BUILDING: 'Building',
  PROVISIONAL: 'Provisional',
}

export const CONFIDENCE_EXPLANATION: Record<ConfidenceLevel, string> = {
  HIGH: 'Backed by confirmed, verifiable data.',
  BUILDING: "Real, but still filling in — it'll sharpen as you add more signal.",
  PROVISIONAL: "Our best early read — treat it as a starting point, not a verdict.",
}

// Tailwind classes for the small confidence pill shown next to each
// category — deliberately quieter than the grade color itself, since
// confidence is metadata about the grade, not a second grade.
export const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-success/10 text-success',
  BUILDING: 'bg-brand/10 text-brand',
  PROVISIONAL: 'bg-muted text-muted-foreground',
}

export interface CategoryGrade {
  key: CategoryKey
  label: string
  score: number
  grade: Grade
  confidence: ConfidenceLevel
  selfAwareness?: SelfAwarenessRead
}

// The four weekly-effort engines — internal machinery for the weekly nudge
// and the category-minimum floor rule below, not a displayed grade of
// their own. "Networking" is the candidate-facing label for what used to
// be called "Connecting." "Effort" (interview prep + one-time setup
// confirmations) isn't given its own tile in the UI — its points are shown
// transparently as part of the raw weekly point total instead.
export type WeeklyEngineKey = 'learning' | 'effort' | 'working' | 'connecting'

export const WEEKLY_ENGINE_LABEL: Record<WeeklyEngineKey, string> = {
  learning: 'Learning',
  effort: 'Effort',
  working: 'Working',
  connecting: 'Networking',
}

export const WEEKLY_ENGINE_EXPLANATION: Record<WeeklyEngineKey, string> = {
  learning: "Whether you've done the foundational work — a complete profile, the How I Work Best assessment, a real target defined.",
  effort: "How many of your action-plan confirmations you've actually completed, plus jobs you've run through fit feedback.",
  working: 'Real assets you\'ve built — a resume on file, work samples, active LinkedIn posting.',
  connecting: "Real outreach and network signals — your networking list, references requested, and community engagement.",
}

export interface WeeklyEngine {
  key: WeeklyEngineKey
  label: string
  score: number
  grade: Grade
}

// From week 4 onward, none of the four engines can fall below this floor —
// you can't earn credit for a strong week by maxing one engine while
// neglecting the others. Below week 4, a single strong engine can still
// carry the weekly nudge, since there's been no time yet to build all four
// out. This only affects the weekly nudge, never the category baselines.
export const CATEGORY_MINIMUM_ENFORCED_FROM_WEEK = 4
export const CATEGORY_MINIMUM_SCORE_FLOOR = 50 // grade C

export interface DossierCompetencies {
  score: number
  grade: Grade
  categories: CategoryGrade[]

  // Weekly effort — an input to the score above, not a second grade.
  weeklyEngines: WeeklyEngine[]
  categoryMinimumsMet: boolean
  laggingEngines: WeeklyEngineKey[]
  // Real point counts for the current Weekly Search Sprint — 1 point = 1
  // minute of effort, shown transparently to the candidate (deliberately
  // not hidden behind the "no raw numbers" convention that applies to the
  // category grades above, since visible points are the whole point of
  // this system).
  weeklyPoints: number
  weeklyPointsTarget: number
  recognizedWeeklyPoints: number
  // The Public/Semi-Public networking-effort bonus folded into weeklyPoints
  // by computeWeeklyEngines (0 when not applicable) — broken out so the
  // dashboard can show candidates where their weekly total actually comes
  // from instead of leaving a gap between "points earned" and the sum of
  // their visible committed actions.
  weeklyVisibilityBonus: number

  // Bonus multiplier: executive coach +10%, prior-week-A +10%, both stack,
  // capped at +20% total combined. Applied to recognizedWeeklyPoints before
  // it feeds the weekly nudge — never to the category baselines directly.
  bonusMultiplier: number
  hasExecutiveCoach: boolean
  hadPriorWeekA: boolean
}
