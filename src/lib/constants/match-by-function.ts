// Generic keyword-based matcher against CandidateProfile.primaryFunction —
// relocated out of ai-tools-by-function.ts (where it originated with a
// single consumer, ai-fluency-workflows.ts) now that certifications,
// business-skills, and function-training content all need the same
// function-branching logic. A neutral home avoids every new content file
// having to import a "tools" file just to reuse its matcher.
export function matchByFunction<T>(
  primaryFunction: string | null,
  groups: { keywords: string[]; value: T }[]
): T | null {
  if (!primaryFunction) return null
  const normalized = primaryFunction.toLowerCase()
  const match = groups.find((group) => group.keywords.some((k) => normalized.includes(k)))
  return match?.value ?? null
}

// Single source of truth for "is this function sales-adjacent" — used both
// by AI_TOOLS_BY_KEYWORD's sales group (ai-tools-by-function.ts) and the
// Learning page's sales-section gating predicate (Phase 8), so the two
// checks can never drift apart.
export const SALES_KEYWORDS = ['sales', 'account executive', 'business development', 'revenue']
