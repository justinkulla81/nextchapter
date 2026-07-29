import 'server-only'
import type { CareerTrajectory } from '@prisma/client'
import type { CategoryGrade, CategoryKey } from '@/lib/scoring/grade'
import {
  AI_FLUENCY_GAP_ID,
  JOB_HOPPING_GAP_ID,
  STABLE_TENURE_STRENGTH_ID,
  CAREER_TRAJECTORY_STRENGTH_ID,
  CAREER_TRAJECTORY_GAP_ID,
} from '@/lib/scoring/named-reason-ids'

export { isResumeSpecificGap } from '@/lib/scoring/named-reason-ids'

// Market Reality Grade's structured, individually-referenceable named
// reasons — short, specific, labeled gaps/strengths (not a paragraph of
// prose), each with a stable id so the Executive Dossier can reference
// "which named reason does this section address" and drive its dynamic
// section reweighting (see dossier's closed-loop callout).
export interface NamedReason {
  id: string
  kind: 'gap' | 'strength'
  text: string
  category: CategoryKey
}

const GRADE_TO_SCORE: Record<CategoryGrade['grade'], number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }

// Per-category gap/strength copy. C-grade categories are deliberately
// skipped — not clearly enough a gap or a strength to name with confidence,
// same "don't fabricate a pattern" principle used elsewhere in this scoring
// system (see coach/pre-session-brief.ts's avoidance-pattern heuristic).
// Every gap is framed as what a hiring manager or recruiter would actually
// notice reviewing the candidate, not as generic self-improvement advice —
// the point is to name the market-facing consequence, not just the
// internal trait, so it's clear why closing it matters.
const CATEGORY_REASONS: Record<CategoryKey, { gap: string; strength: string }> = {
  targetFit: {
    gap: "A recruiter scanning your background will notice your target — the role, industry, or level — doesn't line up with it yet. That mismatch is working against you right now, not just your effort.",
    strength: 'Real market demand and a well-matched, clearly named target are working in your favor.',
  },
  leadership: {
    gap: "A hiring manager reviewing your background won't find clear evidence of leadership scope — sharpen how you describe scale and impact, or get a reference that speaks to it directly.",
    strength: 'Clear, evidenced leadership scope — this reads well to a hiring manager.',
  },
  skillsExecution: {
    gap: "A recruiter looking for proof you finish what you start won't find much evidence of it yet — sharpen your core skill evidence or follow-through record.",
    strength: 'Strong, well-evidenced core skills and follow-through.',
  },
  communication: {
    gap: 'A hiring manager reading your materials, or talking to your references, may notice your communication doesn\'t come across as clearly as it could.',
    strength: 'Communication reads clearly and consistently across your profile and references.',
  },
  adaptability: {
    gap: "A recruiter may notice you're asking for a bigger change than your flexibility signals support — strengthen how you show realism about the change you're pursuing.",
    strength: "You're showing real flexibility and a clear-eyed read on the change you're pursuing.",
  },
  ownership: {
    gap: "A hiring manager checking references will notice limited third-party evidence yet that people can hand you something and trust it gets done.",
    strength: 'References back up that you can be trusted to follow through without supervision.',
  },
}

const AI_FLUENCY_STRENGTH_ID = 'ai_fluency_strength'

export interface StructuralFlags {
  jobHoppingFlag: boolean
  careerTrajectory: CareerTrajectory | null
  /** Real roles counted after internship exclusion — see work-history-facts.ts. */
  realRoleCount?: number
  shortTenureCount?: number
  averageTenureMonths?: number | null
}

// The bar for claiming stability as a strength, deliberately stricter than
// "didn't trip the job-hopping flag". Job-hopping fires at 3+ sub-year
// roles; the mere absence of that is not evidence of anything for someone
// with two jobs. This requires a track record long enough to actually read
// as stable — same "don't fabricate a pattern" rule the rest of this file
// follows.
const STABLE_TENURE_MIN_ROLES = 3
const STABLE_TENURE_MIN_AVG_MONTHS = 24

export function hasStableTenure(flags: StructuralFlags): boolean {
  return (
    !flags.jobHoppingFlag &&
    (flags.realRoleCount ?? 0) >= STABLE_TENURE_MIN_ROLES &&
    (flags.shortTenureCount ?? 0) === 0 &&
    (flags.averageTenureMonths ?? 0) >= STABLE_TENURE_MIN_AVG_MONTHS
  )
}

export function computeNamedReasons(
  categories: CategoryGrade[],
  aiFluencyExample: string | null,
  structuralFlags?: StructuralFlags
): NamedReason[] {
  const reasons: NamedReason[] = []

  for (const cat of categories) {
    const score = GRADE_TO_SCORE[cat.grade]
    const copy = CATEGORY_REASONS[cat.key]
    if (score >= 3) {
      reasons.push({ id: `${cat.key}_strength`, kind: 'strength', text: copy.strength, category: cat.key })
    } else if (score <= 1) {
      reasons.push({ id: `${cat.key}_gap`, kind: 'gap', text: copy.gap, category: cat.key })
    }
  }

  // AI Fluency isn't one of the six scored categories (no reliable signal
  // existed until the "judgment call" capture on the AI project log) —
  // named as a standalone reason rather than forcing it into the fixed
  // six-category scoring model.
  if (aiFluencyExample) {
    reasons.push({
      id: AI_FLUENCY_STRENGTH_ID,
      kind: 'strength',
      text: `Concrete evidence of directing AI toward a real judgment call: ${aiFluencyExample}`,
      category: 'skillsExecution',
    })
  } else {
    reasons.push({
      id: AI_FLUENCY_GAP_ID,
      kind: 'gap',
      text: 'A hiring manager will notice no visible signal of AI fluency in a function being reshaped by it.',
      category: 'skillsExecution',
    })
  }

  // Structural, resume-derived facts — not part of the six-category grade
  // loop above (they're folded into ownership's score there), but named
  // separately since they're specific, evidence-based patterns a hiring
  // manager notices on their own, distinct from the reference-based
  // "can you be trusted" signal the rest of ownership carries.
  if (structuralFlags?.jobHoppingFlag) {
    reasons.push({
      id: JOB_HOPPING_GAP_ID,
      kind: 'gap',
      text: 'Several roles under a year each read as a job-hopping pattern to a hiring manager — worth having a clear, specific reason ready (market conditions, layoffs, a wrong-fit sequence) rather than letting each one stand alone.',
      category: 'ownership',
    })
  }
  // The positive counterpart to jobHopping_gap. Stability is something a
  // hiring manager actively values, and until now only its absence was
  // named — a candidate with a long, steady record got no credit for it
  // anywhere in the Dossier.
  if (structuralFlags && hasStableTenure(structuralFlags)) {
    reasons.push({
      id: STABLE_TENURE_STRENGTH_ID,
      kind: 'strength',
      text: 'Your work history shows real staying power — multiple roles, none cut short, averaging over two years each. Hiring managers read that as someone who commits and sees things through.',
      category: 'ownership',
    })
  }
  if (structuralFlags?.careerTrajectory === 'PROMOTED') {
    reasons.push({
      id: CAREER_TRAJECTORY_STRENGTH_ID,
      kind: 'strength',
      text: 'Your work history shows real upward movement — more scope, responsibility, or seniority over time. That reads as a strong, structural positive to a hiring manager.',
      category: 'ownership',
    })
  } else if (structuralFlags?.careerTrajectory === 'DEMOTED') {
    reasons.push({
      id: CAREER_TRAJECTORY_GAP_ID,
      kind: 'gap',
      text: 'Your most recent move reads as a step down in scope or seniority — have a clear, honest one-liner ready for why (relocation, industry pivot, deliberately choosing IC work) before it comes up.',
      category: 'ownership',
    })
  }

  return reasons
}
