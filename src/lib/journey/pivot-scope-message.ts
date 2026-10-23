// The one message a member sees the first time their search reaches outside home. Pure, no model call:
// the skills gap comes from the pathway code (pathway.ts) and the coach words from the coach offer
// (coach/offer.ts), so nothing here is a second copy of either. Unit-tested in src/test/search-scope.test.ts.

import { buildPathway } from '@/lib/journey/pathway'
import { COACH_OFFER_COPY, COACH_OFFER_HREF } from '@/lib/coach/offer'
import { describeOutside, type OutsideHome } from '@/lib/jobs/search-scope'

export interface PivotMessage {
  title: string
  /** What is outside home. */
  outside: string
  /** Why jobs there often score lower. */
  lowerFit: string
  /** The top skills gaps across the functions outside home; empty for an industry or place only. */
  gaps: string[]
  learnHref: string
  coach: { title: string; why: string; whyDetail: string; href: string }
}

export const MAX_GAPS = 3
export const LEARN_HREF = '/dashboard/learning'

export function pivotMessage(input: { outside: OutsideHome; homeFunction: string | null; keywords: string[]; seniorLevel?: boolean }): PivotMessage {
  const { outside } = input
  const gaps: string[] = []
  for (const fn of outside.functions) {
    const path = buildPathway(input.homeFunction, fn, { keywords: input.keywords, seniorLevel: input.seniorLevel })
    for (const need of path?.need ?? []) if (!gaps.includes(need)) gaps.push(need)
  }
  const kinds = [outside.functions.length > 0 && 'function', outside.industries.length > 0 && 'industry', outside.places.length > 0 && 'place'].filter(Boolean)
  const lowerFit =
    outside.functions.length > 0
      ? 'Jobs there will often score a lower fit today because your résumé shows less of the work they ask for. We still show them, and each one says why.'
      : outside.industries.length > 0
        ? 'Jobs there will often score a lower fit today because your résumé shows less of the industry. We still show them, and each one says why.'
        : 'Jobs there will often score a lower fit today because they are outside the place you searched from. We still show them, and each one says why.'
  const { title, why, whyDetail } = COACH_OFFER_COPY.pivot
  return {
    title: `You are now looking outside your usual ${kinds.length > 1 ? 'field, industry or place' : kinds[0] === 'function' ? 'field' : kinds[0] === 'industry' ? 'industry' : 'place'}`,
    outside: describeOutside(outside),
    lowerFit,
    gaps: gaps.slice(0, MAX_GAPS),
    learnHref: LEARN_HREF,
    coach: { title, why, whyDetail, href: COACH_OFFER_HREF },
  }
}
