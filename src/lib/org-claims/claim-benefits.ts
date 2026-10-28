import type { KitKind } from './org-kit'

// What an organization's page gives the people who find it, in the order the claim page tells it: the positive things first (jobs, employers
// hiring, how to reach it, events, training and colleges, other help), and nothing about layoffs, which sit at the bottom of every page.
// Only what the public page for that kind of organization really shows today; an incentives section is not on these pages yet, so it is not listed.

export const CLAIM_BENEFITS: Record<KitKind | 'OTHER', string[]> = {
  WORKFORCE_BOARD: ['Jobs open across your service area', 'Employers hiring most nearby', 'How to reach you, in one place', 'Events you host', 'Colleges and training in your area', 'Other help in the same area'],
  JOB_CENTER: ['Jobs open where you serve', 'Employers hiring most nearby', 'Your address, hours and contacts', 'Events you host', 'Colleges and training nearby', 'Other help in the same area'],
  ECON_DEV: ['Jobs and employers hiring in your area', 'How to reach you, in one place', 'Events you host', 'Colleges and training in your area', 'Other help in the same area'],
  COLLEGE: ['What your students study, and the jobs that fit', 'AI and data programs', 'Jobs open near campus and who is hiring', 'Job search help near campus', 'Events and conferences you host'],
  EMPLOYER: ['Your open roles, with pay compared to the market', 'Where and what you hire for', 'Events you host or attend', 'Answers to common questions about working with you'],
  OTHER: ['A page for your organization, built from public data', 'Jobs and employers hiring in your area', 'How to reach you, in one place', 'Events, training and other help nearby'],
}

export function claimBenefits(kind: KitKind | null | undefined): string[] {
  return CLAIM_BENEFITS[kind ?? 'OTHER']
}
