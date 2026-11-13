// What a firm may see of a candidate's search, decided only by the scopes the
// candidate granted that firm. Pure (no Next.js or database imports) so tests
// can pin the rule. Anything outside a granted scope never leaves this file.

import type { IntakeConsentScope } from './constants'

export type CoarseStatus = 'SEARCHING' | 'INTERVIEWING' | 'LANDED' | 'NOT_SEARCHING'

export const COARSE_STATUS_LABELS: Record<CoarseStatus, string> = {
  SEARCHING: 'Searching',
  INTERVIEWING: 'Interviewing',
  LANDED: 'Landed',
  NOT_SEARCHING: 'Not searching right now',
}

// Coarser than the candidate's own stages on purpose: an offer shows as
// Interviewing and the plan's inner steps are never shared.
export function coarseStatus(stage: string | null | undefined): CoarseStatus | null {
  switch (stage) {
    case 'EXPLORING':
    case 'PREPARING':
    case 'APPLYING':
      return 'SEARCHING'
    case 'INTERVIEWING':
    case 'OFFER':
      return 'INTERVIEWING'
    case 'LANDED':
      return 'LANDED'
    case 'STAYING':
    case 'PAUSED':
      return 'NOT_SEARCHING'
    default:
      return null
  }
}

export type StatusSource = {
  journeyStage: string | null
  journeyStageChangedAt: Date | null
  // The current job, read only when the candidate has landed.
  currentJob: { companyName: string; roleTitle: string; startDate: Date } | null
}

export type CandidateStatusView = {
  status: { value: CoarseStatus; label: string; changedAt: Date | null } | null
  landing: { employer: string; title: string; startDate: Date } | null
}

export function buildCandidateStatus(scopes: readonly string[], source: StatusSource | null): CandidateStatusView {
  const has = (s: IntakeConsentScope) => scopes.includes(s)
  const value = source ? coarseStatus(source.journeyStage) : null
  return {
    status: source && value && has('status') ? { value, label: COARSE_STATUS_LABELS[value], changedAt: source.journeyStageChangedAt } : null,
    landing:
      source && value === 'LANDED' && has('landing_details') && source.currentJob
        ? { employer: source.currentJob.companyName, title: source.currentJob.roleTitle, startDate: source.currentJob.startDate }
        : null,
  }
}

// True when the page has something to read the profile for. Saves the query
// for firms the candidate shared nothing with.
export function needsProfileRead(scopes: readonly string[]): boolean {
  return scopes.includes('status') || scopes.includes('landing_details')
}
