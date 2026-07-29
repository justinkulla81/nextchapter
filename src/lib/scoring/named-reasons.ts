import 'server-only'
import type { CategoryGrade, CategoryKey } from '@/lib/scoring/grade'
import { AI_FLUENCY_GAP_ID } from '@/lib/scoring/named-reason-ids'

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
const CATEGORY_REASONS: Record<CategoryKey, { gap: string; strength: string }> = {
  targetFit: {
    gap: "Your target — the role, industry, and how well it lines up with your background — is working against you right now, not just your effort.",
    strength: 'Real market demand and a well-matched, clearly named target are working in your favor.',
  },
  leadership: {
    gap: "Leadership scope isn't clearly evidenced yet — worth sharpening how you describe scale and impact, or gathering a reference that speaks to it directly.",
    strength: 'Clear, evidenced leadership scope — this reads well to a hiring manager.',
  },
  skillsExecution: {
    gap: 'Core skill confidence or evidence of finishing what you start could be sharper.',
    strength: 'Strong, well-evidenced core skills and follow-through.',
  },
  communication: {
    gap: 'How you communicate could come across more clearly, on paper or in how references describe it.',
    strength: 'Communication reads clearly and consistently across your profile and references.',
  },
  adaptability: {
    gap: "Flexibility or realism about the change you're asking for could be stronger.",
    strength: "You're showing real flexibility and a clear-eyed read on the change you're pursuing.",
  },
  ownership: {
    gap: 'Limited third-party evidence yet that people can hand you something and trust it gets done.',
    strength: 'References back up that you can be trusted to follow through without supervision.',
  },
}

const AI_FLUENCY_STRENGTH_ID = 'ai_fluency_strength'

export function computeNamedReasons(categories: CategoryGrade[], aiFluencyExample: string | null): NamedReason[] {
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
      text: 'No visible signal of AI fluency in a function being reshaped by it.',
      category: 'skillsExecution',
    })
  }

  return reasons
}
