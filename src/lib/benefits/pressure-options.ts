// Prompt 72 — the fixed multi-select replacing the old free-text "biggest
// financial pressure" question. 'OTHER' pairs with a conditional free-text
// field (benefitsPressureOtherText) rather than being itself free text, so
// every other value stays a clean, structured signal.
export const BENEFITS_PRESSURE_OPTIONS = [
  { value: 'RENT_MORTGAGE', label: 'Rent or mortgage' },
  { value: 'HEALTH_INSURANCE', label: 'Health insurance' },
  { value: 'DEPENDENTS_CHILDCARE', label: 'Dependents / childcare' },
  { value: 'DEBT_PAYMENTS', label: 'Debt payments' },
  { value: 'NO_EMERGENCY_SAVINGS', label: 'No emergency savings' },
  { value: 'SUPPORTING_FAMILY', label: 'Supporting family members' },
  { value: 'IMMIGRATION_STATUS', label: 'Immigration status tied to income' },
  { value: 'OTHER', label: 'Other' },
] as const

export type BenefitsPressureValue = (typeof BENEFITS_PRESSURE_OPTIONS)[number]['value']

export function benefitsPressureLabel(value: string): string {
  return BENEFITS_PRESSURE_OPTIONS.find((o) => o.value === value)?.label ?? value
}
