// Plans that include coaching sessions — Master Build Script §A2.2/§A2.3.
// Free, Resume, and outplacement Core don't include coaching, so they're
// left out of the per-plan sessions-included editor. Kept as a plain
// constants file (not exported from actions.ts) since a "use server" file
// can only export async functions, not values.
export const COACHING_ELIGIBLE_PLAN_KEYS = [
  'outplacement_plus',
  'outplacement_premium',
  'dtc_coaching_plus',
  'dtc_coaching_premium',
] as const
