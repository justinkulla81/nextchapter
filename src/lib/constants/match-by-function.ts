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

// Shared keyword groups for the five functions ai-tools-by-function.ts
// didn't originally cover — used byte-identical in both that file's
// AI_TOOLS_BY_KEYWORD and function-training.ts's FUNCTION_TRAINING, so the
// two halves of the Learning page's function section can never disagree
// about which candidates see which content.
export const DESIGN_KEYWORDS = ['designer', 'ux', 'ui/ux', 'product design', 'creative director', 'design']
export const CUSTOMER_SUCCESS_KEYWORDS = ['customer success', 'customer support', 'client success', 'implementation manager']
export const DATA_ANALYTICS_KEYWORDS = ['data scientist', 'data analyst', 'analytics', 'business intelligence', 'bi analyst', 'machine learning engineer', 'ml engineer', 'data & analytics']
export const EXECUTIVE_LEADERSHIP_KEYWORDS = ['chief executive', 'chief operating', 'chief financial', 'ceo', 'coo', 'cfo', 'cto', 'cmo', 'cpo', 'president', 'general manager', 'executive leadership']
export const ADMINISTRATION_KEYWORDS = ['administrative assistant', 'office manager', 'executive assistant', 'administration']
