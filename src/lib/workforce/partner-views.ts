// Partner views, pure parts: what a view can include, its status, and its address. No database here.

export const PARTNER_KINDS = [
  { key: 'COLLEGE', label: 'College or training provider' },
  { key: 'EMPLOYER', label: 'Employer' },
  { key: 'OTHER', label: 'Someone else' },
] as const
export type PartnerKind = (typeof PARTNER_KINDS)[number]['key']
export const PARTNER_KIND_KEYS: string[] = PARTNER_KINDS.map((k) => k.key)

export const VIEW_SCOPES = [
  { key: 'SKILLS', label: 'Skills: what employers ask for, what people show, and the gap' },
  { key: 'TALENT', label: 'Talent: counts by function, seniority and time out of work' },
  { key: 'PROFILES', label: 'De-identified profiles (Candidate A, B, C)' },
  { key: 'JOBS', label: 'Jobs in the region' },
  { key: 'PROGRAMS', label: 'Our programs' },
] as const
export type ViewScope = (typeof VIEW_SCOPES)[number]['key']
export const VIEW_SCOPE_KEYS: string[] = VIEW_SCOPES.map((s) => s.key)

/** What most partners of each kind want first. */
export const DEFAULT_SCOPES: Record<string, ViewScope[]> = {
  COLLEGE: ['SKILLS', 'JOBS', 'PROGRAMS'],
  EMPLOYER: ['SKILLS', 'TALENT'],
  OTHER: ['SKILLS'],
}

export const EXPIRY_DAYS = [30, 90] as const

/** Keep only known scopes, once each, in a fixed order. Profiles always come with the talent counts they are drawn from. */
export function normalizeScopes(input: string[]): string[] {
  const want = new Set(input.filter((s) => VIEW_SCOPE_KEYS.includes(s)))
  if (want.has('PROFILES')) want.add('TALENT')
  return VIEW_SCOPE_KEYS.filter((k) => want.has(k))
}

export type ViewStatus = 'Active' | 'Expired' | 'Revoked'
export function viewStatus(v: { expiresAt: Date; revokedAt: Date | null }, now = new Date()): ViewStatus {
  if (v.revokedAt) return 'Revoked'
  return v.expiresAt.getTime() <= now.getTime() ? 'Expired' : 'Active'
}

/** The address a partner opens. */
export const viewUrl = (origin: string, slug: string, token: string) => `${origin}/i/${slug}/view/${token}`

/** A token that is long enough not to be guessed (about 192 bits), safe in a link. */
export function isPlausibleToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{24,64}$/.test(t)
}
