import type { CandidateProfile } from '@prisma/client'
import { InterimListingCategory } from '@prisma/client'

// Prompt 68 section 2 — which fractional/talent-marketplace categories a
// candidate actually sees, tailored from real onboarding signal
// (primaryFunction + secondaryFunction, targetCompanyStage) rather than one
// undifferentiated list for everyone. MARKETPLACE_ANY_FUNCTION is always
// included — that's the function-agnostic option regardless of background.
type ProfileForMarketplaceTailoring = Pick<
  CandidateProfile,
  'primaryFunction' | 'secondaryFunction' | 'targetCompanyStage'
>

const TECHNICAL_FUNCTIONS = new Set(['Engineering', 'Data & Analytics', 'Product', 'Design'])
const GENERAL_FUNCTIONS = new Set(['Operations', 'Finance', 'Executive Leadership', 'General'])

export function getRelevantMarketplaceCategories(
  profile: ProfileForMarketplaceTailoring
): InterimListingCategory[] {
  const categories: InterimListingCategory[] = [InterimListingCategory.MARKETPLACE_ANY_FUNCTION]

  // A candidate's most recent role(s) can sit in a different function than
  // the bulk of their career (secondaryFunction) — checked alongside
  // primaryFunction everywhere below, not just primaryFunction alone.
  const functions = [profile.primaryFunction, profile.secondaryFunction].filter((f): f is string => !!f)

  if (functions.some((f) => TECHNICAL_FUNCTIONS.has(f))) {
    categories.push(InterimListingCategory.MARKETPLACE_TECHNICAL)
  }
  if (functions.some((f) => GENERAL_FUNCTIONS.has(f))) {
    categories.push(InterimListingCategory.MARKETPLACE_GENERAL)
  }
  if (functions.includes('Marketing')) {
    categories.push(InterimListingCategory.MARKETPLACE_MARKETING)
  }
  // "Startup-stage operator" — an Operations background specifically
  // targeting startup-stage companies, not just any Operations candidate.
  if (functions.includes('Operations') && profile.targetCompanyStage === 'startup') {
    categories.push(InterimListingCategory.MARKETPLACE_STARTUP)
  }

  return categories
}
