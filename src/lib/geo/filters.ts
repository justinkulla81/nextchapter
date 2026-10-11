import type { Prisma } from '@prisma/client'

// Threshold filters for geographies, shared by the Geographies list and the
// Economic-development leads list so "high white-collar unemployment" means the
// same thing on both. Every option is a preset, so a filtered view is one URL.

type Opt = { value: string; label: string; where?: Prisma.GeoAreaWhereInput }

export const POP_BANDS: Opt[] = [
  { value: '', label: 'Any size' },
  { value: 'xs', label: 'Under 25,000', where: { population: { lt: 25_000 } } },
  { value: 's', label: '25,000 to 100,000', where: { population: { gte: 25_000, lt: 100_000 } } },
  { value: 'm', label: '100,000 to 500,000', where: { population: { gte: 100_000, lt: 500_000 } } },
  { value: 'l', label: '500,000 to 1 million', where: { population: { gte: 500_000, lt: 1_000_000 } } },
  { value: 'xl', label: '1 million or more', where: { population: { gte: 1_000_000 } } },
]
export const WC_UNEMP: Opt[] = [
  { value: '', label: 'Any white-collar unemployment (est.)' },
  { value: '2', label: 'White-collar est. 2% or more', where: { wcUnemploymentEst: { gte: 2 } } },
  { value: '3', label: 'White-collar est. 3% or more', where: { wcUnemploymentEst: { gte: 3 } } },
  { value: '4', label: 'White-collar est. 4% or more', where: { wcUnemploymentEst: { gte: 4 } } },
  { value: '5', label: 'White-collar est. 5% or more', where: { wcUnemploymentEst: { gte: 5 } } },
]
export const UNEMP: Opt[] = [
  { value: '', label: 'Any unemployment rate' },
  { value: 'lt3', label: 'Under 3%', where: { unemploymentRate: { lt: 3 } } },
  { value: '3', label: '3% or more', where: { unemploymentRate: { gte: 3 } } },
  { value: '4', label: '4% or more', where: { unemploymentRate: { gte: 4 } } },
  { value: '5', label: '5% or more', where: { unemploymentRate: { gte: 5 } } },
  { value: '6', label: '6% or more', where: { unemploymentRate: { gte: 6 } } },
]
export const INCOME: Opt[] = [
  { value: '', label: 'Any median income' },
  { value: 'lt50', label: 'Below $50,000', where: { medianHouseholdIncome: { lt: 50_000 } } },
  { value: '50', label: '$50,000 to $75,000', where: { medianHouseholdIncome: { gte: 50_000, lt: 75_000 } } },
  { value: '75', label: '$75,000 to $100,000', where: { medianHouseholdIncome: { gte: 75_000, lt: 100_000 } } },
  { value: '100', label: '$100,000 or more', where: { medianHouseholdIncome: { gte: 100_000 } } },
]
export const WC_SHARE: Opt[] = [
  { value: '', label: 'Any white-collar share' },
  { value: '35', label: 'White-collar 35% or more', where: { whiteCollarShare: { gte: 0.35 } } },
  { value: '45', label: 'White-collar 45% or more', where: { whiteCollarShare: { gte: 0.45 } } },
  { value: '55', label: 'White-collar 55% or more', where: { whiteCollarShare: { gte: 0.55 } } },
]
export const LAYOFFS: Opt[] = [
  { value: '', label: 'Any layoff activity' },
  { value: 'any', label: 'Any layoffs, last 12 months', where: { layoffs12mo: { gt: 0 } } },
  { value: '100', label: '100+ workers, last 12 months', where: { layoffs12mo: { gte: 100 } } },
  { value: '500', label: '500+ workers, last 12 months', where: { layoffs12mo: { gte: 500 } } },
  { value: '90', label: 'Any layoffs, last 90 days', where: { layoffs90d: { gt: 0 } } },
]
export const EXTRAS: Opt[] = [
  { value: '', label: 'Any local assets' },
  { value: 'he', label: 'Has a college', where: { higherEdCount: { gt: 0 } } },
  { value: 'dc', label: 'Has a data center', where: { dataCenterCount: { gt: 0 } } },
  { value: 'both', label: 'College and data center', where: { higherEdCount: { gt: 0 }, dataCenterCount: { gt: 0 } } },
]

export const GEO_FILTERS = [
  { key: 'pop', label: 'Size', opts: POP_BANDS },
  { key: 'wc', label: 'White-collar unemployment', opts: WC_UNEMP },
  { key: 'un', label: 'Unemployment', opts: UNEMP },
  { key: 'inc', label: 'Income', opts: INCOME },
  { key: 'wcs', label: 'White-collar share', opts: WC_SHARE },
  { key: 'lay', label: 'Layoffs', opts: LAYOFFS },
  { key: 'ex', label: 'Local assets', opts: EXTRAS },
] as const

/** Combines the presets named in the query string into one where clause. */
export function geoWhere(sp: Record<string, string | undefined>): Prisma.GeoAreaWhereInput[] {
  const out: Prisma.GeoAreaWhereInput[] = []
  for (const f of GEO_FILTERS) {
    const hit = f.opts.find((o) => o.value && o.value === sp[f.key])
    if (hit?.where) out.push(hit.where)
  }
  return out
}

export const REVENUE_BANDS: { value: string; label: string; where?: Prisma.GeoOrgLeadWhereInput }[] = [
  { value: '', label: 'Any budget' },
  { value: 'lt500', label: 'Under $500K', where: { revenue: { lt: 500_000 } } },
  { value: '500', label: '$500K to $2M', where: { revenue: { gte: 500_000, lt: 2_000_000 } } },
  { value: '2m', label: '$2M to $10M', where: { revenue: { gte: 2_000_000, lt: 10_000_000 } } },
  { value: '10m', label: '$10M or more', where: { revenue: { gte: 10_000_000 } } },
]

export const KIND_LABELS: Record<string, string> = {
  ECON_DEV: 'Economic development',
  CHAMBER: 'Chamber of commerce',
  WORKFORCE: 'Workforce nonprofit',
}

export const money = (n: number | null | undefined) =>
  n == null ? '–' : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`
export const pct = (n: number | null | undefined, d = 1) => (n == null ? '–' : `${n.toFixed(d)}%`)
export const num = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString())

/** A local board before a statewide one: "your workforce board" must be the local one. */
export function localFirst<T extends { statewide?: boolean }>(boards: T[]): T[] {
  return [...boards].sort((a, b) => Number(!!a.statewide) - Number(!!b.statewide))
}
