// Whether a member is senior enough that the senior track applies. Judged from their level and title only,
// never from age or years of experience (which stand in for age). Pure: src/test/coach-offer.test.ts.

import { memberBand } from '@/lib/pivots/scoring'

const SENIOR_TITLE = /\b(vp|svp|evp|vice president|chief|c[a-z]o|president|partner|managing director|general manager|founder)\b/i

export function seniorMember(p: { highestLevelReached?: string | null; resumeLatestJobTitle?: string | null }): boolean {
  if (memberBand(p.highestLevelReached) === 'EXEC') return true
  return !!p.resumeLatestJobTitle && SENIOR_TITLE.test(p.resumeLatestJobTitle)
}
