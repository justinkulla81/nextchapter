// What an institution's plan includes. Pure (no database, no server-only), so
// pages, actions, routes and tests all read the same answer.
//
// Two plans. PAID is every institution that existed before plans (the column
// defaults to 'PAID', so nothing already set up loses anything) and anyone
// NextChapter staff switch on. FREE is a verified, claimed workspace (owner
// decisions 2026-11-17): members are always free and anyone can join, but
// staff see only the first FREE_VISIBLE_MEMBERS of them (the rest show as a
// count; src/lib/plans/visible-members.ts); one administrator; unlimited member
// companies and invites; basic counts, its own services and its page.
//
// The plan is an extra gate that only restricts FREE. The license tier still
// decides which workspaces open (src/lib/higher-ed/workspaces.ts); PAID
// behaves exactly as it did before this file existed. Outplacement is
// contract-based and is not touched here.

export type InstitutionPlan = 'FREE' | 'PAID'

// No limit on how many people join a free organization (owner decision 2026-11-17). Kept as a named value so older
// readers compile; null means no cap.
export const FREE_MEMBER_CAP: number | null = null
// How many of its members a free organization's staff can see.
export const FREE_VISIBLE_MEMBERS = 5
// How many administrators a free organization has.
export const FREE_ADMIN_LIMIT = 1
// How many grants a free organization sees in full; the rest are blurred.
export const FREE_VISIBLE_GRANTS = 2

// Where a free organization asks for the paid plan: the support address the
// portal already shows (RegionScreen). There is no self-serve billing.
export const PLAN_CONTACT_EMAIL = 'support@launchyournextchapter.com'

export type EntitlementFeature = 'reporting' | 'exports' | 'crmExchange' | 'staffRoles' | 'auditLog' | 'sso' | 'nextchapterServices' | 'wioa' | 'members' | 'grants' | 'publicPage'

export type Entitlements = {
  // Most members the organization can hold; null = no cap.
  memberCap: number | null
  // How many members its staff can see by name; null = all.
  visibleMembers: number | null
  // How many administrators it can have; null = no limit.
  adminLimit: number | null
  // How many grants it sees in full; null = all.
  visibleGrants: number | null
  reporting: boolean
  exports: boolean
  crmExchange: boolean
  staffRoles: boolean
  auditLog: boolean
  sso: boolean
  nextchapterServices: boolean
  wioa: boolean
  // Writing its own section on its public page (owner decision 2026-11-17).
  publicPage: boolean
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
    return { memberCap: null, visibleMembers: null, adminLimit: null, visibleGrants: null, reporting: true, exports: true, crmExchange: true, staffRoles: true, auditLog: true, sso: true, nextchapterServices: true, wioa: true, publicPage: true }
  }
  return { memberCap: FREE_MEMBER_CAP, visibleMembers: FREE_VISIBLE_MEMBERS, adminLimit: FREE_ADMIN_LIMIT, visibleGrants: FREE_VISIBLE_GRANTS, reporting: false, exports: false, crmExchange: false, staffRoles: false, auditLog: false, sso: false, nextchapterServices: false, wioa: false, publicPage: false }
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
  members: `Seeing more than ${FREE_VISIBLE_MEMBERS} of your members is`,
  grants: `Every grant that fits you, with a shortlist, is`,
  publicPage: 'Writing your own section on your public page is',
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
  members: 'See all your members',
  grants: 'Every grant that fits you',
  publicPage: 'Your public page',
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
  'alumni:data': 'reporting',
  'admin:board': 'reporting',
  'development:crm': 'crmExchange',
  'admin:activity': 'auditLog',
  'workforce:home': 'wioa',
  'workforce:etpl': 'wioa',
  'admin:publicpage': 'publicPage',
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
  if (feature === 'members') return e.visibleMembers === null
  if (feature === 'grants') return e.visibleGrants === null
  return e[feature]
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
