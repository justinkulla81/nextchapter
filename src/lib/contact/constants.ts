import type { ContactAudience } from '@prisma/client'

export const CONTACT_AUDIENCES: { value: ContactAudience; label: string }[] = [
  { value: 'CANDIDATE', label: 'Someone looking for my next role' },
  { value: 'ORGANIZATION', label: 'An organization' },
  { value: 'COACH_RECRUITER', label: 'A coach or recruiter' },
  { value: 'OTHER', label: 'Press or something else' },
]

export const CONTACT_AUDIENCE_SHORT: Record<ContactAudience, string> = {
  CANDIDATE: 'Job seeker',
  ORGANIZATION: 'Organization',
  COACH_RECRUITER: 'Coach or recruiter',
  OTHER: 'Press / other',
}

export const CONTACT_EMAIL = 'hello@launchyournextchapter.com'
export const SUPPORT_EMAIL = 'support@launchyournextchapter.com'
export const COMPANY_LINKEDIN_URL = 'https://www.linkedin.com/company/launchyournextchapter/'
export const FOUNDER_LINKEDIN_URL = 'https://www.linkedin.com/in/justinkulla/'
