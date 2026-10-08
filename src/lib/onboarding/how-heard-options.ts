import type { CandidateLeadSource, ReferrerKind } from '@prisma/client'

// "How did you hear about NextChapter?" — answer value → what it records.
// A recommender answer also takes the typed name and becomes a
// CandidateReferral (so "who recommended whom" is answerable); the rest set
// the lead source only.
export const HOW_HEARD_OPTIONS: { value: string; label: string; source: CandidateLeadSource; referrer?: ReferrerKind }[] = [
  { value: 'LINKEDIN', label: 'LinkedIn', source: 'LINKEDIN' },
  { value: 'EMAIL', label: 'An email or newsletter', source: 'EMAIL' },
  { value: 'SEARCH', label: 'Google or an AI assistant', source: 'SEARCH' },
  { value: 'SOCIAL', label: 'Another social network', source: 'SOCIAL' },
  { value: 'FOUNDER', label: 'Justin or the NextChapter team', source: 'REFERRAL_ADMIN', referrer: 'FOUNDER' },
  { value: 'COACH', label: 'A coach', source: 'COACH', referrer: 'COACH' },
  { value: 'RECRUITER', label: 'A recruiter', source: 'RECRUITER', referrer: 'RECRUITER' },
  { value: 'HIGHER_ED', label: 'A university or career center', source: 'HIGHER_ED', referrer: 'HIGHER_ED' },
  { value: 'FRIEND', label: 'A friend or colleague', source: 'REFERRAL_OTHER', referrer: 'OTHER' },
  { value: 'OTHER', label: 'Somewhere else', source: 'OTHER' },
]

