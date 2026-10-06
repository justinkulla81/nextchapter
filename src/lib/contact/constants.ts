import type { ContactAudience } from '@prisma/client'

export const CONTACT_AUDIENCES: { value: ContactAudience; label: string }[] = [
  { value: 'CANDIDATE', label: 'I want help finding my next role' },
  { value: 'ORGANIZATION', label: 'I represent an organization' },
  { value: 'COACH_RECRUITER', label: 'I’m a coach or recruiter' },
  { value: 'JOB_APPLICANT', label: 'I’m applying for a job at NextChapter' },
  { value: 'OTHER', label: 'Press or something else' },
]

export const CONTACT_AUDIENCE_SHORT: Record<ContactAudience, string> = {
  CANDIDATE: 'Job seeker',
  ORGANIZATION: 'Organization',
  COACH_RECRUITER: 'Coach or recruiter',
  JOB_APPLICANT: 'Job applicant',
  OTHER: 'Press / other',
}

export const CONTACT_EMAIL = 'contact@launchyournextchapter.com'
export const SUPPORT_EMAIL = 'support@launchyournextchapter.com'
export const COMPANY_LINKEDIN_URL = 'https://www.linkedin.com/company/launchyournextchapter/'
export const FOUNDER_LINKEDIN_URL = 'https://www.linkedin.com/in/justinkulla/'
