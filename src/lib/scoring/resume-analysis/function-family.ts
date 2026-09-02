// Function family detection — spec §6: "Detect family from titles and
// content, not from a self-declared field. Where ambiguous, score against
// the more permissive norm." Deliberately does not read
// CandidateProfile.primaryFunction (a self-declared field) as the source of
// truth — only as a tie-breaker when title/content keywords are themselves
// ambiguous, per the spec's explicit instruction.

import type { ResumeAnalysisFacts } from './extract-facts'
import type { FunctionFamily } from './types'

const FAMILY_KEYWORDS: Record<FunctionFamily, RegExp> = {
  REVENUE: /\b(sales|account executive|business development|customer success|revenue|quota|pipeline)\b/i,
  MARKETING: /\b(marketing|brand|demand gen|growth|content|seo|campaign)\b/i,
  ENGINEERING: /\b(engineer|software|developer|architect|devops|infrastructure|technical)\b/i,
  PRODUCT: /\b(product manager|product owner|product lead|roadmap)\b/i,
  FINANCE: /\b(finance|accounting|controller|treasury|fp&a|audit)\b/i,
  OPERATIONS: /\b(operations|supply chain|logistics|manufacturing|procurement)\b/i,
  PEOPLE: /\b(human resources|hr\b|people|talent|recruiting|chro)\b/i,
  LEGAL: /\b(legal|counsel|compliance|regulatory|attorney)\b/i,
  CLINICAL: /\b(clinical|physician|nurse|patient|healthcare|medical)\b/i,
  GENERAL_MANAGEMENT: /\b(general manager|president|ceo|coo|managing director|p&l)\b/i,
}

// Per-role classification — added for the functionTrackConsistency dimension
// (dimensions.ts), which needs to know which family EACH role belongs to,
// not just the one aggregate family detectFunctionFamily produces for the
// whole candidate. Deliberately a separate function rather than a refactor
// of detectFunctionFamily's own loop: that function counts, per family,
// how many roles match THAT family's own pattern independently (so a title
// matching two families' keywords counts toward both), while this returns
// only the first match in FAMILY_KEYWORDS order — routing detectFunctionFamily
// through this would silently change its existing tie-breaking behavior.
// Returns null when a title matches no family's keywords at all — the
// caller's job to decide what "unclassified" means for its own scoring.
export function classifyRoleFunctionFamily(title: string): FunctionFamily | null {
  for (const [family, pattern] of Object.entries(FAMILY_KEYWORDS) as [FunctionFamily, RegExp][]) {
    if (pattern.test(title)) return family
  }
  return null
}

export function detectFunctionFamily(facts: ResumeAnalysisFacts): FunctionFamily {
  const scores = (Object.entries(FAMILY_KEYWORDS) as [FunctionFamily, RegExp][]).map(([family, pattern]) => {
    const matches = facts.roles.filter((r) => pattern.test(r.title)).length
    return { family, matches }
  })

  const best = scores.reduce((max, cur) => (cur.matches > max.matches ? cur : max), scores[0])

  // Ambiguous (no keyword match anywhere, or a tie) — score against the
  // more permissive norm per spec §6, which General Management is: it has
  // no doNotExpect list, so nothing gets penalized for evidence it lacks.
  if (best.matches === 0) return 'GENERAL_MANAGEMENT'

  const tiedCount = scores.filter((s) => s.matches === best.matches).length
  if (tiedCount > 1) return 'GENERAL_MANAGEMENT'

  return best.family
}
