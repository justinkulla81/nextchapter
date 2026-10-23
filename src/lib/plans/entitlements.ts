// What an institution's plan includes. Pure (no database, no server-only), so
// pages, actions, routes and tests all read the same answer.
//
// Two plans. PAID is every institution that existed before plans (the column
// defaults to 'PAID', so nothing already set up loses anything) and anyone
// NextChapter staff switch on. FREE is a verified, claimed workspace: members
// are always free; the organization holds up to FREE_MEMBER_CAP of them, sees
// basic counts, lists its own services and has its page.
//
// The plan is an extra gate that only restricts FREE. The license tier still
// decides which workspaces open (src/lib/higher-ed/workspaces.ts); PAID
// behaves exactly as it did before this file existed. Outplacement is
// contract-based and is not touched here.

export type InstitutionPlan = 'FREE' | 'PAID'

export const FREE_MEMBER_CAP = 50

// Where a free organization asks for the paid plan: the support address the
// portal already shows (RegionScreen). There is no self-serve billing.
export const PLAN_CONTACT_EMAIL = 'support@launchyournextchapter.com'

export type EntitlementFeature = 'reporting' | 'exports' | 'crmExchange' | 'staffRoles' | 'auditLog' | 'sso' | 'nextchapterServices' | 'wioa' | 'members'

export type Entitlements = {
  // Most members the organization can hold; null = no cap.
  memberCap: number | null
  reporting: boolean
  exports: boolean
  crmExchange: boolean
  staffRoles: boolean
  auditLog: boolean
  sso: boolean
  nextchapterServices: boolean
  wioa: boolean
}

export const isInstitutionPlan = (v: unknown): v is InstitutionPlan => v === 'FREE' || v === 'PAID'

// Anything that is not exactly 'FREE' is PAID, so a missing or unexpected
// value never takes features away from an existing customer.
export function planOf(v: unknown): InstitutionPlan {
  return v === 'FREE' ? 'FREE' : 'PAID'
}

export function institutionEntitlements(input: { plan: string | null | undefined; tier?: string | null; enabledFeatures?: unknown }): Entitlements {
  // tier and enabledFeatures stay with the workspace gating (tierIncludes and
  // the wioa switch). Accepted so callers can pass one institution row; unused
  // here on purpose, so the plan can only restrict, never grant.
  if (planOf(input.plan) === 'PAID') {
    return { memberCap: null, reporting: true, exports: true, crmExchange: true, staffRoles: true, auditLog: true, sso: true, nextchapterServices: true, wioa: true }
  }
  return { memberCap: FREE_MEMBER_CAP, reporting: false, exports: false, crmExchange: false, staffRoles: false, auditLog: false, sso: false, nextchapterServices: false, wioa: false }
}

const WHAT: Record<EntitlementFeature, string> = {
  reporting: 'Reporting and outcomes are',
  exports: 'Exports are',
  crmExchange: 'The CRM exchange is',
  staffRoles: 'Staff roles beyond the administrator are',
  auditLog: 'The activity log is',
  sso: 'Single sign-on is',
  nextchapterServices: 'Using NextChapter’s coaching and courses is',
  wioa: 'Workforce (WIOA) reporting is',
  members: `More than ${FREE_MEMBER_CAP} members are`,
}

export const LOCKED_TITLES: Record<EntitlementFeature, string> = {
  reporting: 'Reporting and outcomes',
  exports: 'Exports',
  crmExchange: 'CRM exchange',
  staffRoles: 'Staff roles',
  auditLog: 'Activity log',
  sso: 'Single sign-on',
  nextchapterServices: 'NextChapter coaching and courses',
  wioa: 'Workforce (WIOA) reporting',
  members: 'More members',
}

// Plain words: what is locked, and the one thing to do about it.
export function lockedReason(feature: EntitlementFeature): string {
  return `${WHAT[feature]} part of the paid plan. Ask us to switch your plan on at ${PLAN_CONTACT_EMAIL}.`
}

export function planChangeMailto(feature: EntitlementFeature, slug: string): string {
  return `mailto:${PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent(`Switch on the paid plan for ${slug}`)}&body=${encodeURIComponent(`I would like ${LOCKED_TITLES[feature].toLowerCase()} for ${slug}.`)}`
}

// ── Member cap ───────────────────────────────────────────────────────────────

export type CapRoom = { allowed: boolean; cap: number | null; left: number | null; message: string | null }

// How many more members fit. `current` is the members already held; `adding`
// is what the action would add. A null cap (PAID) always fits.
export function capRoom(cap: number | null, current: number, adding: number): CapRoom {
  if (cap === null) return { allowed: true, cap, left: null, message: null }
  const left = Math.max(0, cap - current)
  if (current + adding <= cap) return { allowed: true, cap, left, message: null }
  return { allowed: false, cap, left, message: capMessage(cap, left, adding) }
}

export function capMessage(cap: number, left: number, adding: number): string {
  const room = left === 0 ? 'there is no room left' : left === 1 ? 'there is room for 1 more' : `there is room for ${left} more`
  return `The free plan holds up to ${cap} members and ${room}, but this would add ${adding}. Remove some rows to fit, or ask us to switch on the paid plan at ${PLAN_CONTACT_EMAIL}.`
}

// Invitations: nobody is added, so the message says who is left waiting.
export function inviteCapMessage(cap: number, waiting: number): string {
  const rest = waiting > 0 ? ` ${waiting} ${waiting === 1 ? 'person is' : 'people are'} still waiting for an invitation.` : ''
  return `The free plan holds up to ${cap} members, and all ${cap} places are used.${rest} To invite more, ask us to switch on the paid plan at ${PLAN_CONTACT_EMAIL}.`
}

// The screens a FREE organization sees locked, keyed "workspace:tab".
export const GATED_SCREENS: Record<string, EntitlementFeature> = {
  'development:home': 'reporting',
  'career:outcomes': 'reporting',
  'admin:board': 'reporting',
  'development:crm': 'crmExchange',
  'admin:activity': 'auditLog',
  'workforce:home': 'wioa',
  'workforce:etpl': 'wioa',
}

// Export kind -> the feature it needs. my-data and member-data are privacy
// rights (an alum's own record, FERPA requests) and are never plan-gated.
export const GATED_EXPORTS: Record<string, EntitlementFeature> = {
  updates: 'crmExchange',
  suppression: 'crmExchange',
  etpl: 'exports',
  wioa: 'wioa',
}

export function featureOn(e: Entitlements, feature: EntitlementFeature): boolean {
  return feature === 'members' ? e.memberCap === null : e[feature]
}

// The feature that blocks this export kind on this plan, or null when it may be downloaded.
export function blockedExport(kind: string, plan: string | null | undefined): EntitlementFeature | null {
  const feature = GATED_EXPORTS[kind]
  return feature && !featureOn(institutionEntitlements({ plan }), feature) ? feature : null
}

// The feature that locks this screen ("workspace:tab") on this plan, or null.
export function blockedScreen(screenKey: string, plan: string | null | undefined): EntitlementFeature | null {
  const feature = GATED_SCREENS[screenKey]
  return feature && !featureOn(institutionEntitlements({ plan }), feature) ? feature : null
}
