import 'server-only'

/**
 * Hunter.io: finds and verifies business email addresses. Metered — every
 * call spends account credits (Email Finder and Domain Search use searches,
 * the Verifier uses verifications), so callers pass a budget and stop when
 * it's spent. Needs HUNTER_API_KEY.
 *
 * An address is only ever treated as real when Hunter verifies it as
 * deliverable ("valid") with a high score; anything less stays a guess.
 */

const BASE = 'https://api.hunter.io/v2'
export const TRUSTED_SCORE = 90

export function hunterConfigured(): boolean {
  return !!process.env.HUNTER_API_KEY
}

async function call<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, api_key: process.env.HUNTER_API_KEY ?? '' })
  const res = await fetch(`${BASE}/${path}?${qs}`, { signal: AbortSignal.timeout(20_000) }).catch(() => null)
  if (!res) return null
  if (res.status === 429) throw new Error('Hunter rate limit reached — try again later')
  if (res.status === 401 || res.status === 403) throw new Error('Hunter rejected the API key or the plan is out of credits')
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as { data?: T } | null
  return body?.data ?? null
}

export interface HunterAccount {
  plan_name: string
  requests: { searches: { used: number; available: number }; verifications: { used: number; available: number } }
}

export function hunterAccount() {
  return call<HunterAccount>('account', {})
}

export interface HunterFound {
  email: string | null
  score: number | null
  status: string | null // valid | accept_all | unknown | invalid | …
  position: string | null
}

/** Email Finder: one search credit. */
export async function hunterFindEmail(domain: string, firstName: string, lastName: string): Promise<HunterFound | null> {
  const d = await call<{ email: string | null; score: number | null; position: string | null; verification?: { status: string | null } }>(
    'email-finder',
    { domain, first_name: firstName, last_name: lastName }
  )
  return d ? { email: d.email, score: d.score, status: d.verification?.status ?? null, position: d.position } : null
}

/** Email Verifier: one verification credit. */
export async function hunterVerifyEmail(email: string): Promise<{ status: string; score: number | null } | null> {
  const d = await call<{ status: string; score: number | null }>('email-verifier', { email })
  return d ? { status: d.status, score: d.score } : null
}

export interface HunterPerson {
  email: string
  firstName: string | null
  lastName: string | null
  position: string | null
  confidence: number | null
  status: string | null
}

/** Domain Search for senior people: one search credit per call (up to `limit` results). */
export async function hunterDomainSearch(domain: string, limit = 10): Promise<{ pattern: string | null; people: HunterPerson[] } | null> {
  const d = await call<{
    pattern: string | null
    emails: { value: string; first_name: string | null; last_name: string | null; position: string | null; confidence: number | null; type: string; verification?: { status: string | null } }[]
  }>('domain-search', { domain, limit: String(limit), type: 'personal', seniority: 'senior,executive' })
  if (!d) return null
  return {
    pattern: d.pattern,
    people: d.emails.map((e) => ({
      email: e.value,
      firstName: e.first_name,
      lastName: e.last_name,
      position: e.position,
      confidence: e.confidence,
      status: e.verification?.status ?? null,
    })),
  }
}

/** Whether a Hunter result is good enough to store as someone's real email. */
export function isTrustedEmail(status: string | null, score: number | null): boolean {
  return status === 'valid' && (score ?? 0) >= TRUSTED_SCORE
}
