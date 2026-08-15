import type { PlanBillingPeriod, PlanCatalogCategory } from '@prisma/client'

// Plain constants shared by server code (src/lib/admin/plan-catalog.ts) and
// client components (e.g. PlanCatalogForm) — kept separate from
// plan-catalog.ts's `import 'server-only'` DB helpers so a client component
// can import the labels without pulling in server-only code. Same split as
// src/lib/constants/coach-session-type.ts.

// Seed keys and display names — Master Build Script §A2.2 (outplacement),
// §A2.3 (direct-to-consumer), §A2.4 (membership). This is the fixed list of
// plans the business currently sells; admin can add new effective-dated
// rows under these keys but does not invent new planKeys through the UI
// this phase.
export const PLAN_KEYS = [
  'outplacement_core',
  'outplacement_plus',
  'outplacement_premium',
  'dtc_free',
  'dtc_resume',
  'dtc_coaching_plus',
  'dtc_coaching_premium',
  'membership_alumni',
  'membership_monthly',
  'membership_annual',
] as const

export type PlanKey = (typeof PLAN_KEYS)[number]

export const PLAN_LABELS: Record<PlanKey, string> = {
  outplacement_core: 'Outplacement — Core',
  outplacement_plus: 'Outplacement — Plus',
  outplacement_premium: 'Outplacement — Premium',
  dtc_free: 'Direct-to-consumer — Free',
  dtc_resume: 'Direct-to-consumer — Resume',
  dtc_coaching_plus: 'Direct-to-consumer — Coaching Plus',
  dtc_coaching_premium: 'Direct-to-consumer — Coaching Premium',
  membership_alumni: 'Membership — Alumni (free)',
  membership_monthly: 'Membership — monthly',
  membership_annual: 'Membership — annual',
}

export const PLAN_CATEGORY_LABELS: Record<PlanCatalogCategory, string> = {
  OUTPLACEMENT: 'Outplacement',
  DIRECT_TO_CONSUMER: 'Direct-to-consumer',
  MEMBERSHIP: 'Membership & alumni',
}

export const BILLING_PERIOD_LABELS: Record<PlanBillingPeriod, string> = {
  NONE: 'No charge',
  ONE_TIME: 'One-time',
  MONTHLY: 'Per month',
  ANNUAL: 'Per year',
}
