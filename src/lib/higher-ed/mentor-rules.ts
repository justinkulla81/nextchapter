// Pure rules for the alumni mentor flow (HE-09). No database access, so they
// are unit-tested directly (src/test/mentor-rules.test.ts).

export const MAX_CALLS_PER_MONTH_CAP = 8
export const MAX_TAGS = 6
export const MAX_TAG_LENGTH = 40

export function clampCalls(n: number): number {
  if (!Number.isFinite(n)) return 2
  return Math.min(MAX_CALLS_PER_MONTH_CAP, Math.max(1, Math.round(n)))
}

// "Finance, operations; Health care" -> ['Finance', 'operations', 'Health care'], de-duplicated
// case-insensitively, capped in count and length.
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[,;\n]/)) {
    const t = part.trim().slice(0, MAX_TAG_LENGTH)
    const k = t.toLowerCase()
    if (!t || seen.has(k)) continue
    seen.add(k)
    out.push(t)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

// A mentor can accept a limited number of calls a month. Open requests
// (REQUESTED or ACCEPTED) this month count against the limit, so the mentor is
// never flooded and a requester sees "full this month" up front.
export function mentorHasRoom(openRequestsThisMonth: number, maxCallsPerMonth: number): boolean {
  return openRequestsThisMonth < maxCallsPerMonth
}

export type MentorMatchInput = { industries: string[]; functions: string[] }

// How well a mentor's tags match what the seeker asked for. Empty filters match
// everyone. Case-insensitive substring so "health" matches "Health care".
export function matchesFilter(m: MentorMatchInput, industry: string, fn: string): boolean {
  const hit = (tags: string[], q: string) => !q.trim() || tags.some((t) => t.toLowerCase().includes(q.trim().toLowerCase()))
  return hit(m.industries, industry) && hit(m.functions, fn)
}

// Show a first name and last initial only, never a full surname, before a
// request is accepted.
export function displayName(first: string | null, last: string | null): string {
  const f = (first ?? '').trim()
  const l = (last ?? '').trim()
  if (!f && !l) return 'An alum'
  return l ? `${f || 'Alum'} ${l[0].toUpperCase()}.` : f
}
