// What the member wants in a package besides pay: six benefits they tick and
// three numbers they may leave blank. Saved from the Pay page and turned into
// the "what to ask for" list there (benefits.ts). Pure, so it is unit-tested.

export const PACKAGE_BENEFIT_OPTIONS = [
  { value: 'wantsHealthDentalVisionInsurance', label: 'Health, dental and vision insurance' },
  { value: 'wants401kMatch', label: 'A 401(k) or retirement plan' },
  { value: 'wantsDisabilityInsurance', label: 'Disability insurance' },
  { value: 'wantsProfessionalDevReimbursement', label: 'Professional development reimbursement' },
  { value: 'wantsCommuterBenefits', label: 'Commuter benefits' },
  { value: 'wantsGymMembership', label: 'A gym membership' },
] as const

export type PackageBenefitKey = (typeof PACKAGE_BENEFIT_OPTIONS)[number]['value']

export const PACKAGE_NUMBER_FIELDS = [
  { name: 'ptoWeeksExpected', label: 'Weeks of paid time off', max: 20 },
  { name: 'remoteDaysPerWeekDesired', label: 'Days a week working from home', max: 5 },
  { name: 'paidParentalLeaveWeeksExpected', label: 'Weeks of paid parental leave', max: 52 },
] as const

export type PackageNumberKey = (typeof PACKAGE_NUMBER_FIELDS)[number]['name']

export type PackageWishes = Record<PackageBenefitKey, boolean> & Record<PackageNumberKey, number | null>

export type PackageWishesResult = { ok: true; wishes: PackageWishes } | { ok: false; error: string }

// Ticked benefits are "yes"; anything not ticked is "no". A number left blank is
// "no preference"; anything else must be a whole number in its range.
export function parsePackageWishes(input: { benefits: string[]; numbers: Record<PackageNumberKey, string | null> }): PackageWishesResult {
  const ticked = new Set(input.benefits)
  const benefits = Object.fromEntries(PACKAGE_BENEFIT_OPTIONS.map((o) => [o.value, ticked.has(o.value)])) as Record<PackageBenefitKey, boolean>

  const numbers = {} as Record<PackageNumberKey, number | null>
  for (const field of PACKAGE_NUMBER_FIELDS) {
    const raw = input.numbers[field.name]?.trim()
    if (!raw) {
      numbers[field.name] = null
      continue
    }
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0 || n > field.max) {
      return { ok: false, error: `${field.label}: enter a whole number from 0 to ${field.max}, or leave it blank.` }
    }
    numbers[field.name] = n
  }
  return { ok: true, wishes: { ...benefits, ...numbers } }
}
