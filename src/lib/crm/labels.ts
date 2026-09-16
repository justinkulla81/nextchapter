import type { CrmPersonRole, CrmOrgType, CrmLeadQuality, CrmWarmth, CrmEligibility, CrmPriorityTier } from '@prisma/client'

// Human labels for the CRM enums. Sentence case per design-principles.md.
//
// Category-prefixed on purpose (F: funding-side, BD: business development,
// NC: network/contact, GTM: go-to-market) — with 19 contact types, a flat
// list stopped being scannable, and the prefix groups related ones visually
// even though PERSON_ROLES (below) sorts the actual list alphabetically by
// this label text, not by category.
export const PERSON_ROLE_LABELS: Record<CrmPersonRole, string> = {
  INVESTOR_VC: 'F: Investor (VC)',
  INVESTOR_ANGEL: 'F: Investor (Angel)',
  INCUBATOR: 'F: Incubator',
  GRANTS: 'F: Grants',
  STRATEGIC: 'F: Strategic',
  BD_PARTNER: 'BD: Partner',
  RECRUITER_PROSPECT: 'BD: Recruiter',
  COACH_PROSPECT: 'BD: Coach',
  HIRING_MANAGER: 'BD: Hiring Manager',
  OUTPLACEMENT_BUYER: 'BD: Outplacement',
  ALUMNI_OFFICE: 'BD: Alumni',
  ADVISOR: 'NC: Advisor',
  EMPLOYEE_CANDIDATE: 'NC: Employee',
  CONNECTOR: 'NC: Connector',
  POLICY_ANALYST: 'NC: Policy/Academic',
  JOB_SEEKER: 'NC: Candidate',
  OTHER: 'NC: Other',
  PRESS: 'GTM: Press/Media',
  GTM_PARTNER: 'GTM: Partner',
}

export const ORG_TYPE_LABELS: Record<CrmOrgType, string> = {
  VC_FUND: 'VC fund',
  ANGEL_SYNDICATE: 'Angel syndicate',
  FUNDER_GRANT: 'Grant / non-equity funder',
  EMPLOYER: 'Employer',
  OUTPLACEMENT_LEAD: 'Outplacement lead',
  OUTPLACEMENT_FIRM: 'Outplacement firm',
  SEARCH_FIRM: 'Search firm',
  COACHING_FIRM: 'Coaching firm',
  UNIVERSITY: 'University',
  THINK_TANK: 'Think tank',
  GOVERNMENT: 'Government',
  FOUNDATION: 'Foundation',
  NONPROFIT: 'Nonprofit',
  MEDIA: 'Media',
  ACCELERATOR: 'Accelerator',
  VENDOR: 'Vendor / partner',
  OTHER: 'Other',
}

export const QUALITY_LABELS: Record<CrmLeadQuality, string> = {
  A: 'A — top target',
  B: 'B — good fit',
  C: 'C — low urgency',
  D: 'D — poor fit',
  UNGRADED: 'Ungraded',
}

export const WARMTH_LABELS: Record<CrmWarmth, string> = {
  HOT: 'Hot',
  WARM: 'Warm',
  COLD: 'Cold',
  UNKNOWN: 'Unknown',
}

export const ELIGIBILITY_LABELS: Record<CrmEligibility, string> = {
  FOR_PROFIT_ELIGIBLE: 'For-profit eligible',
  PARTNER_OR_RESEARCH: 'Via partner only',
  UNKNOWN: 'Unknown',
  NONPROFIT_ONLY: 'Nonprofit only',
  NOT_APPLICABLE: 'Not applicable',
}

export const PRIORITY_TIER_LABELS: Record<CrmPriorityTier, string> = {
  P0: 'Immediate',
  P1: 'High',
  P2: 'Not urgent',
}

// Alphabetical by the display label, not enum declaration order — every
// contact-type list in the CRM (checkboxes, filters, bulk-add) reads off
// this one array, so ordering it here orders it everywhere at once.
export const PERSON_ROLES = (Object.keys(PERSON_ROLE_LABELS) as CrmPersonRole[])
  .sort((a, b) => PERSON_ROLE_LABELS[a].localeCompare(PERSON_ROLE_LABELS[b]))
export const ORG_TYPES = Object.keys(ORG_TYPE_LABELS) as CrmOrgType[]
export const QUALITIES = Object.keys(QUALITY_LABELS) as CrmLeadQuality[]
export const WARMTHS = Object.keys(WARMTH_LABELS) as CrmWarmth[]
export const PRIORITY_TIERS = Object.keys(PRIORITY_TIER_LABELS) as CrmPriorityTier[]

/** Colour tokens per priority tier — P0 reads as urgent, P2 as calmer. */
export function priorityTierClass(t: CrmPriorityTier | null): string {
  switch (t) {
    case 'P0': return 'bg-destructive/10 text-destructive'
    case 'P1': return 'bg-orange/15 text-orange'
    case 'P2': return 'bg-muted text-muted-foreground'
    default: return 'bg-muted text-muted-foreground/60'
  }
}

/** Colour tokens per quality grade — A is the only one that reads as "act on this". */
export function qualityClass(q: CrmLeadQuality): string {
  switch (q) {
    case 'A': return 'bg-brand/15 text-brand'
    case 'B': return 'bg-muted text-foreground'
    case 'C': return 'bg-muted text-muted-foreground'
    case 'D': return 'bg-muted text-muted-foreground line-through'
    default: return 'bg-muted text-muted-foreground'
  }
}

export function formatDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

/** "3 days ago" / "Never" — the number that tells you whether a lead is going cold. */
export function sinceLabel(d: Date | null | undefined): string {
  if (!d) return 'Never'
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
