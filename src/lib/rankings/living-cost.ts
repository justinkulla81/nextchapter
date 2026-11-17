// What a salary is worth where it is earned: pay minus a year of owning the typical home, with everything else priced locally.
// Pure, so every rule is unit-tested without a database.
//
// Why not divide by the BEA price level alone: the all-items regional price parity weights housing at about a sixth of
// spending, so a metro where housing costs twice the national level still reads only 10 to 20% dearer, and a pay ranking
// "after cost of living" ends up ranking pay. Here housing is taken out in dollars instead, and the price level for the rest
// of spending is the parity with housing removed.

/** Housing's weight in the all-items price parity, found by regressing the all-items parity on its four parts across the 387
 * metros in metro-compare.json (goods 0.295, housing 0.168, utilities 0.012, other services 0.515). */
export const HOUSING_WEIGHT = 0.168

/** The yearly cost of owning the median home: a 30-year fixed mortgage at this rate on 80% of its value, plus property tax and
 * insurance at 1.5% of value a year. Published on the ranking pages as an assumption. */
export const MORTGAGE_RATE = 0.065
export const DOWN_PAYMENT = 0.2
export const TAX_AND_INSURANCE = 0.015

/** A place's prices: the all-items parity (US = 100), its housing part where we have it, and the median home value. */
export interface Cost {
  rpp: number
  housingRpp: number | null
  home: number | null
  rent: number | null
  basis: 'metro' | 'state'
}

export function ownCostPerYear(home: number): number {
  const i = MORTGAGE_RATE / 12
  const monthly = (i / (1 - (1 + i) ** -360)) * home * (1 - DOWN_PAYMENT)
  return monthly * 12 + home * TAX_AND_INSURANCE
}

/** The price level of everything but housing (US = 100). Without a housing part, the all-items parity stands in. */
export function nonHousingParity(cost: Pick<Cost, 'rpp' | 'housingRpp'>): number {
  return cost.housingRpp != null ? (cost.rpp - HOUSING_WEIGHT * cost.housingRpp) / (1 - HOUSING_WEIGHT) : cost.rpp
}

/** Pay left after a year of owning the median home, in national prices. Null when we have no home value for the place. */
export function payAfterLiving(pay: number, cost: Cost): number | null {
  if (!cost.home) return null
  return (pay - ownCostPerYear(cost.home)) / (nonHousingParity(cost) / 100)
}

export const LIVING_COST_METHOD = [
  `Pay after cost of living is the median posted salary, minus a year of owning the area's median home, then adjusted for what everything else costs there. The yearly cost of owning is a 30-year fixed mortgage at ${(MORTGAGE_RATE * 100).toFixed(1)}% on ${Math.round((1 - DOWN_PAYMENT) * 100)}% of the median home value plus ${(TAX_AND_INSURANCE * 100).toFixed(1)}% of the value for property tax and insurance. Everything else is priced with the Bureau of Economic Analysis regional price parity with housing taken out (United States = 100).`,
  'Housing is counted in dollars because the all-items price parity weights it at about a sixth of spending, which hides most of the gap between, say, San Jose and Columbus. Pay is before tax. Home values are the Census median for the metro area, or the state where a city is outside one.',
]

export const LIVING_COST_SOURCES = 'Census Bureau American Community Survey 2020-2024 (median home value) and Bureau of Economic Analysis regional price parities 2024'
