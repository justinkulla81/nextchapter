import type { CandidateProfile } from '@prisma/client'
import { InterimListingCategory } from '@prisma/client'

// Prompt 68 section 2 — which fractional/talent-marketplace categories a
// candidate actually sees, tailored from real onboarding signal
// (primaryFunction, targetCompanyStage) rather than one undifferentiated
// list for everyone. MARKETPLACE_ANY_FUNCTION is always included — that's
// the function-agnostic option regardless of background.
type ProfileForMarketplaceTailoring = Pick<CandidateProfile, 'primaryFunction' | 'targetCompanyStage'>

const TECHNICAL_FUNCTIONS = new Set(['Engineering', 'Data & Analytics', 'Product', 'Design'])
const GENERAL_FUNCTIONS = new Set(['Operations', 'Finance', 'Executive Leadership', 'General'])

export function getRelevantMarketplaceCategories(
  profile: ProfileForMarketplaceTailoring
): InterimListingCategory[] {
  const categories: InterimListingCategory[] = [InterimListingCategory.MARKETPLACE_ANY_FUNCTION]

  if (profile.primaryFunction && TECHNICAL_FUNCTIONS.has(profile.primaryFunction)) {
    categories.push(InterimListingCategory.MARKETPLACE_TECHNICAL)
  }
  if (profile.primaryFunction && GENERAL_FUNCTIONS.has(profile.primaryFunction)) {
    categories.push(InterimListingCategory.MARKETPLACE_GENERAL)
  }
  if (profile.primaryFunction === 'Marketing') {
    categories.push(InterimListingCategory.MARKETPLACE_MARKETING)
  }
  // "Startup-stage operator" — an Operations background specifically
  // targeting startup-stage companies, not just any Operations candidate.
  if (profile.primaryFunction === 'Operations' && profile.targetCompanyStage === 'startup') {
    categories.push(InterimListingCategory.MARKETPLACE_STARTUP)
  }

  return categories
}
