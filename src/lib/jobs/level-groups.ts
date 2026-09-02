// Level-synonym grouping for MARKET SCARCITY estimation specifically — a
// deliberately separate, coarser system from infer-job-function.ts's own
// LEVEL_KEYWORDS (which drives job-matching/level-rank and treats "Head of"
// as Director-equivalent). For counting how many open roles exist for a
// candidate's target, the goal isn't precise banding, it's a query broad
// enough to catch real equivalent-seniority postings that phrase the level
// differently — "SVP of X" and "Head of X" are the same market for a
// candidate targeting "VP of X," and searching only the literal typed title
// undercounts real openings. Conversely, a bare "Partner" target must NOT
// pull in staff-title postings ("HR Business Partner," "Customer Success
// Partner") the way a naive literal search would — see
// isAmbiguousPartnerTitle's own comment for why that's a real, previously
// confirmed bug in exactly this Adzuna query (adzuna.ts's title_only
// comment documents the "Partner" full-text-match version of it; the
// title_only fix narrowed the match field but a bare "Partner" title-only
// search still catches every staff-partner title, since "Partner" is a
// literal substring of all of them).
//
// Three groups, per the user's explicit instruction: VP/SVP/EVP + Head of +
// Chief of + CxO lumped together (senior leadership, market-scarcity-wise);
// Director/Senior Director; Manager/Senior Manager/Team Lead(er)/Group
// Manager/Group Leader.

import { isAmbiguousPartnerTitle, STAFF_PARTNER_QUALIFIERS } from './infer-job-function'

export type MarketLevelGroup = 'SENIOR_LEADERSHIP' | 'DIRECTOR' | 'MANAGER'

export const LEVEL_GROUP_SYNONYMS: Record<MarketLevelGroup, string[]> = {
  SENIOR_LEADERSHIP: ['VP', 'SVP', 'EVP', 'Vice President', 'Head of', 'Chief', 'President', 'Partner'],
  DIRECTOR: ['Director', 'Senior Director'],
  MANAGER: ['Manager', 'Senior Manager', 'Team Lead', 'Team Leader', 'Group Manager', 'Group Leader'],
}

const SENIOR_LEADERSHIP_PATTERN = /\b(vp|svp|evp|vice\s+president|head\s+of|chief|president|ceo|coo|cfo|cto|cmo|cpo|chro|cro)\b/i
const DIRECTOR_PATTERN = /\bdirector\b/i // "senior director" already contains "director"
const MANAGER_PATTERN = /\b(manager|team\s+lead(er)?|group\s+lead(er)?)\b/i

export function classifyTitleLevelGroup(title: string): MarketLevelGroup | null {
  if (SENIOR_LEADERSHIP_PATTERN.test(title) || isAmbiguousPartnerTitle(title)) return 'SENIOR_LEADERSHIP'
  if (DIRECTOR_PATTERN.test(title)) return 'DIRECTOR'
  if (MANAGER_PATTERN.test(title)) return 'MANAGER'
  return null
}

// Strips the recognized level phrase out of a title, leaving whatever
// functional/practice-area term remains — "VP of Corporate Development" ->
// "Corporate Development", so the Adzuna query can AND the function against
// an OR of level synonyms instead of requiring the literal typed phrase.
// "Partner" is only ever stripped as a level token when it's genuinely
// ambiguous-senior (isAmbiguousPartnerTitle) — a staff title like "Talent
// Partner" keeps "Partner" as part of its real functional core, since it
// isn't a level word there at all.
const NON_PARTNER_LEVEL_STRIP_PATTERNS: RegExp[] = [
  /\bvice\s+president\s+of\b/gi,
  /\b(svp|evp|vp)\s+of\b/gi,
  /\b(svp|evp|vp)\b/gi,
  /\bvice\s+president\b/gi,
  /\bhead\s+of\b/gi,
  /\bchief\s+(\w+\s+)?officer\b/gi,
  /\b(ceo|coo|cfo|cto|cmo|cpo|chro|cro)\b/gi,
  /\bchief\b/gi,
  /\bpresident\s+of\b/gi,
  /\bpresident\b/gi,
  /\bsenior\s+director\s+of\b/gi,
  /\bsenior\s+director\b/gi,
  /\bdirector\s+of\b/gi,
  /\bdirector\b/gi,
  /\bsenior\s+manager\s+of\b/gi,
  /\bsenior\s+manager\b/gi,
  /\bteam\s+lead(er)?\b/gi,
  /\bgroup\s+(manager|lead(er)?)\b/gi,
  /\bmanager\s+of\b/gi,
  /\bmanager\b/gi,
]
const PARTNER_STRIP_PATTERN = /\b(managing\s+partner|general\s+partner|partner)\b/gi

export function extractFunctionalCore(title: string): string {
  let result = title
  for (const pattern of NON_PARTNER_LEVEL_STRIP_PATTERNS) {
    result = result.replace(pattern, ' ')
  }
  if (isAmbiguousPartnerTitle(title)) {
    result = result.replace(PARTNER_STRIP_PATTERN, ' ')
  }
  return result
    .replace(/\s+/g, ' ')
    .replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '')
    .trim()
}

export interface MarketRoleQuery {
  roleType: string | null
  levelGroup: MarketLevelGroup | null
  whatExclude?: string[]
}

// The one function callers (market.ts) should use — decides, per title,
// which of the two fixes applies. A title with a real residual function
// term ("VP of Corporate Development" -> "Corporate Development") gets the
// AND-function/OR-level-breadth treatment. A bare ambiguous Partner title
// has no residual function term to AND against — falling back to a broad
// field like primaryFunction doesn't actually narrow it (confirmed live:
// "Finance" AND "Partner" still returned 1200+ postings, mostly generic
// senior finance titles). The real fix for THAT case is keeping "Partner"
// itself as the search term and excluding the known staff-qualified
// variants instead, which measurably narrows it (confirmed live: 1758 ->
// 42 for a bare "Partner" search).
export function buildMarketRoleQuery(
  targetRoleType: string | null,
  fallbackFunction: string | null
): MarketRoleQuery {
  if (!targetRoleType) return { roleType: null, levelGroup: null }

  const levelGroup = classifyTitleLevelGroup(targetRoleType)
  if (!levelGroup) return { roleType: targetRoleType, levelGroup: null }

  if (isAmbiguousPartnerTitle(targetRoleType)) {
    return { roleType: 'Partner', levelGroup, whatExclude: STAFF_PARTNER_QUALIFIERS }
  }

  const functionalCore = extractFunctionalCore(targetRoleType)
  return { roleType: functionalCore || fallbackFunction || targetRoleType, levelGroup }
}
