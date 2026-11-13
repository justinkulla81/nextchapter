/** The campaign tags the layoff outreach emails put on the page link (src/lib/warn/outreach/copy.ts taggedLink). Client-safe and pure. */
export type OutreachRole = 'hr' | 'partner'
export interface OutreachTags { role: OutreachRole; audience: string; arm: string; noticeId: string }

const AUDIENCE_ROLE: Record<string, OutreachRole> = { hr: 'hr', job_center: 'partner', workforce_board: 'partner', rapid_response: 'partner' }

/** Null unless the visit came from a layoff outreach email. A forwarded link keeps its tags, so a laid-off person who got it from HR gets the same page. */
export function readOutreachTags(search: string): OutreachTags | null {
  const q = new URLSearchParams(search)
  if (q.get('utm_source') !== 'layoff_outreach') return null
  const audience = q.get('utm_campaign') ?? ''
  const role = AUDIENCE_ROLE[audience]
  if (!role) return null
  const arm = q.get('utm_content') === 'A' ? 'A' : 'B'
  return { role, audience, arm, noticeId: (q.get('lo_n') ?? '').slice(0, 40) }
}
