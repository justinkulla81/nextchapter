import type { CrmPersonRole, CrmOrgType, CrmLeadQuality, CrmWarmth, CrmEligibility } from '@prisma/client'

// Human labels for the CRM enums. Sentence case per design-principles.md.
export const PERSON_ROLE_LABELS: Record<CrmPersonRole, string> = {
  INVESTOR_VC: 'Investor (VC)',
  INVESTOR_ANGEL: 'Angel',
  BD_PARTNER: 'BD partner',
  COACH_PROSPECT: 'Coach',
  RECRUITER_PROSPECT: 'Recruiter',
  HIRING_MANAGER: 'Hiring manager',
  CHRO_HR: 'HR / CHRO',
  OUTPLACEMENT_BUYER: 'Outplacement buyer',
  POLICY_ANALYST: 'Policy analyst',
  ACADEMIC: 'Academic',
  ALUMNI_OFFICE: 'Alumni office',
  JOB_SEEKER: 'Job seeker',
  EMPLOYEE_CANDIDATE: 'Potential hire',
  ADVISOR: 'Advisor',
  CONNECTOR: 'Connector',
  PRESS: 'Press',
  OTHER: 'Other',
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

export const PERSON_ROLES = Object.keys(PERSON_ROLE_LABELS) as CrmPersonRole[]
export const ORG_TYPES = Object.keys(ORG_TYPE_LABELS) as CrmOrgType[]
export const QUALITIES = Object.keys(QUALITY_LABELS) as CrmLeadQuality[]
export const WARMTHS = Object.keys(WARMTH_LABELS) as CrmWarmth[]

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
