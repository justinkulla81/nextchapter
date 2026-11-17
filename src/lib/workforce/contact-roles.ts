// The roles a person at a member company can hold (member-contacts.ts). Shared with client forms.

export const CONTACT_ROLES = ['OUTPLACEMENT', 'HIRING', 'LEARNING', 'GRANTS'] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = { OUTPLACEMENT: 'Outplacement', HIRING: 'Hiring', LEARNING: 'Learning and development', GRANTS: 'Grants and RFPs' }
export const CONTACT_ROLE_WHAT: Record<ContactRole, string> = {
  OUTPLACEMENT: 'Layoff seats and how its people are doing',
  HIRING: 'Shared profiles, intros and the jobs it posts',
  LEARNING: 'Asks you for training for its people',
  GRANTS: 'Your grant applications that name it, and the support it offers',
}

export function parseContactRoles(values: string[]): ContactRole[] {
  return CONTACT_ROLES.filter((r) => values.includes(r))
}

// What a grants contact can offer toward a grant or RFP (MemberCompanyRequest.offers).
export const GRANT_OFFERS = ['LETTER', 'MATCH', 'HIRING', 'TRAINING_SITE', 'JOB_SPECS'] as const
export type GrantOffer = (typeof GRANT_OFFERS)[number]
export const GRANT_OFFER_LABELS: Record<GrantOffer, string> = {
  LETTER: 'Letter of support',
  MATCH: 'Cash or in-kind match',
  HIRING: 'Commit to interview or hire',
  TRAINING_SITE: 'Host training or work-based learning',
  JOB_SPECS: 'Share job specs and skills',
}
export const REQUEST_STATUS_LABELS: Record<string, string> = { REQUESTED: 'Waiting for an answer', ACCEPTED: 'Accepted', DECLINED: 'Declined' }
