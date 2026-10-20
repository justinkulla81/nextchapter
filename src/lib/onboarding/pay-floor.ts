// "What is the least you would take?" as one pick, for onboarding. Stored in the
// same field Search Strategy has always used (targetCompMin, whole dollars), so
// nothing is asked twice: Search Strategy opens with this answer filled in. The
// pick sets the floor to the bottom of the band; the member can refine it there.

export const PAY_FLOOR_BANDS: { value: string; label: string; floor: number }[] = [
  { value: 'lt100', label: 'Under $100,000', floor: 75_000 },
  { value: '100', label: '$100,000 to $150,000', floor: 100_000 },
  { value: '150', label: '$150,000 to $200,000', floor: 150_000 },
  { value: '200', label: '$200,000 to $300,000', floor: 200_000 },
  { value: '300', label: '$300,000 to $500,000', floor: 300_000 },
  { value: '500', label: '$500,000 or more', floor: 500_000 },
]

export function payFloorFromBand(value: unknown): number | null {
  return PAY_FLOOR_BANDS.find((b) => b.value === value)?.floor ?? null
}

/** The band a stored floor falls in, to pre-select the dropdown. */
export function bandForFloor(floor: number | null | undefined): string | null {
  if (!floor) return null
  const sorted = [...PAY_FLOOR_BANDS].sort((a, b) => b.floor - a.floor)
  return sorted.find((b) => floor >= b.floor)?.value ?? PAY_FLOOR_BANDS[0].value
}
