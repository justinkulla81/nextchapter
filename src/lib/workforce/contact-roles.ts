// The roles a person at a member company can hold (member-contacts.ts). Shared with client forms.

export const CONTACT_ROLES = ['OUTPLACEMENT', 'HIRING', 'LEARNING', 'GRANTS', 'WORKFORCE', 'COLLEGES'] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = { OUTPLACEMENT: 'Outplacement', HIRING: 'Hiring', LEARNING: 'Learning and development', GRANTS: 'Grants and RFPs', WORKFORCE: 'Workforce development', COLLEGES: 'College partnerships' }
export const CONTACT_ROLE_WHAT: Record<ContactRole, string> = {
  OUTPLACEMENT: 'Layoff seats and how its people are doing',
  HIRING: 'Shared profiles, intros and the jobs it posts',
  LEARNING: 'Asks you for training for its people',
  GRANTS: 'Your grant applications that name it, and the support it offers',
  WORKFORCE: 'Apprenticeships, on-the-job training, job-center hiring events',
  COLLEGES: 'Internships, student projects, advisory boards with colleges',
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
// What a workforce-development contact can offer the public workforce system (MemberCompanyRequest kind WORKFORCE_COLLAB).
export const WORKFORCE_OFFERS = ['APPRENTICESHIP', 'OJT', 'WORK_EXPERIENCE', 'HIRING_EVENT', 'SECTOR'] as const
export const WORKFORCE_OFFER_LABELS: Record<(typeof WORKFORCE_OFFERS)[number], string> = {
  APPRENTICESHIP: 'Host an apprenticeship',
  OJT: 'On-the-job training for a new hire',
  WORK_EXPERIENCE: 'Paid work experience for participants',
  HIRING_EVENT: 'Hiring event at a job center',
  SECTOR: 'Join a sector partnership',
}

// What a college-partnerships contact can offer colleges (MemberCompanyRequest kind COLLEGE_COLLAB).
export const COLLEGE_OFFERS = ['INTERNSHIPS', 'CAPSTONE', 'ADVISORY', 'CURRICULUM', 'SPEAKERS'] as const
export const COLLEGE_OFFER_LABELS: Record<(typeof COLLEGE_OFFERS)[number], string> = {
  INTERNSHIPS: 'Internships',
  CAPSTONE: 'Sponsor a student project',
  ADVISORY: 'Join a program advisory board',
  CURRICULUM: 'Review a curriculum or name skills',
  SPEAKERS: 'Guest speakers or mentors',
}

export const REQUEST_KIND_LABELS: Record<string, string> = { TRAINING: 'Training', GRANT_PARTNER: 'Grant support', WORKFORCE_COLLAB: 'Workforce partnership', COLLEGE_COLLAB: 'College partnership' }
const ALL_OFFER_LABELS: Record<string, string> = { ...GRANT_OFFER_LABELS, ...WORKFORCE_OFFER_LABELS, ...COLLEGE_OFFER_LABELS }
export const offerLabel = (key: string) => ALL_OFFER_LABELS[key] ?? key

export const REQUEST_STATUS_LABELS: Record<string, string> = { REQUESTED: 'Waiting for an answer', ACCEPTED: 'Accepted', DECLINED: 'Declined' }
