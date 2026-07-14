import type { PrivacyTier } from '@prisma/client'

export const PRIVACY_TIERS: Array<{
  value: PrivacyTier
  label: string
  description: string
  preview: string
}> = [
  {
    value: 'PUBLIC',
    label: 'Public',
    description: 'Full name, photo, and complete work history visible to all employers.',
    preview: 'Jordan Smith — Product Manager at Acme Corp',
  },
  {
    value: 'SEMI_PUBLIC',
    label: 'Semi-Public',
    description: 'First name and last initial, company names, and role level visible. No photo.',
    preview: 'Jordan S. — Product Manager, 500-1000 employee company',
  },
  {
    value: 'PRIVATE',
    label: 'Private',
    description: "Fully anonymized — employers see your signal and experience, not your identity.",
    preview: 'Verified Candidate — Product, Manager level, 8 years experience',
  },
  {
    value: 'STEALTH',
    label: 'Stealth',
    description: "Invisible by default. Only companies you've pre-approved can see your profile.",
    preview: 'Not visible in search — only pre-approved employers can view',
  },
  {
    value: 'LOCKED',
    label: 'Locked',
    description: "Completely invisible while you build out your profile. Nobody can find you yet.",
    preview: 'Not visible anywhere yet',
  },
]
