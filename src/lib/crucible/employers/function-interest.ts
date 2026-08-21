import type { CrucibleFunctionInterest, CrucibleJobIntent } from '@prisma/client'

// The one place CrucibleFunctionInterest (employer-side, includes
// GENERALIST) and CrucibleJobIntent (candidate-side, includes UNSURE)
// touch — kept as an explicit mapping rather than merging the two enums,
// since they represent different questions asked to different people.
export function mapFunctionInterestToJobIntent(interest: CrucibleFunctionInterest): CrucibleJobIntent {
  if (interest === 'GENERALIST') return 'UNSURE'
  return interest
}
