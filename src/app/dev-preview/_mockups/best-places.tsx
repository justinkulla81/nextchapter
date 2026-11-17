import { RankingView } from '@/components/rankings/RankingView'
import { buildMetroStats, rankWhitePlaces, whitePlacesSpecs, type CountyFacts, type WcCounts } from '@/lib/rankings/metro-places'
import { COUNTY_SECTORS } from '@/lib/workforce/county-context'

// Sample data only: made-up figures for real metro names, to see the best-places pages before the monthly build fills them.
const NAMES = ['Raleigh-Cary, NC', 'Madison, WI', 'Minneapolis-St. Paul-Bloomington, MN-WI', 'Austin-Round Rock-San Marcos, TX', 'Columbus, OH', 'Denver-Aurora-Centennial, CO', 'Boston-Cambridge-Newton, MA-NH', 'Salt Lake City-Murray, UT', 'Des Moines-West Des Moines, IA', 'Pittsburgh, PA', 'Richmond, VA', 'Omaha, NE-IA']
const sectors = COUNTY_SECTORS.map((s) => s.code)

function sample() {
  const counties = new Map<string, CountyFacts>()
  const postings = new Map<string, WcCounts>()
  const ctx: Record<string, { e: number[]; t: [number, number] }> = {}
  const community: Record<string, (number | null)[]> = {}
  const metros = NAMES.map((name, i) => {
    const f = String(10000 + i)
    const k = (i * 7) % NAMES.length
    counties.set(f, { population: 600_000 + k * 90_000, laborForce: 320_000 + k * 40_000, whiteCollarShare: 0.42 + (k % 5) * 0.03, wcUnemp: 1.8 + (k % 4) * 0.3, colleges: 6 + k, enrollment: 40_000 + k * 6000, ajc: 1 + (k % 3), communityColleges: 1 + (k % 3), supportOrgs: 4 + k, layoffWorkers: 200 + ((k * 37) % 11) * 120 })
    postings.set(f, { n: 2500 + ((k * 13) % 9) * 600, paid: 900 + k * 40, pay: [[95_000 + ((k * 5) % 8) * 4000, 900]], flex: 500 + k * 30, aiPay: [[110_000 + k * 3000, 60]], plainPay: [[95_000 + k * 2000, 800]], socN: 1800, aiSum: 1800 * (0.14 + (k % 6) * 0.01) })
    ctx[f] = { e: sectors.flatMap((code, j) => [4000 + j * 300, 4000 + j * 300 + (code === '54' || code === '52' ? 200 + k * 60 : 0)]), t: [200_000, 210_000] }
    community[f] = [2.5 + (k % 5), 0.18 + (k % 4) * 0.02, 6 + (k % 3), 2.7 + (k % 5) * 0.08, 2.8 + (k % 4) * 0.07, 0.88 + (k % 4) * 0.02, 2000 - k * 400, 1.5 + (k % 3) * 0.4, 0.6 + (k % 4) * 0.08, 0.3 + (k % 5) * 0.03, 4000 + k * 700]
    return { cbsa: String(20000 + i), name: `${name} Metro Area`, counties: [f], rpp: 92 + (k % 7) * 2 }
  })
  return buildMetroStats({ metros, counties, postings, context: { sectors, counties: ctx }, community: { fields: ['homicides', 'childCareCost', 'childCareCenters', 'reading', 'math', 'broadband', 'schoolFunding', 'libraries', 'parks', 'longCommute', 'permitUnits'], counties: community }, housing: () => ({ rent: 1450, home: 390_000 }), statePrograms: new Map(['NC', 'WI', 'MN', 'TX', 'OH', 'CO', 'MA', 'UT', 'IA', 'PA', 'VA', 'NE'].map((st, i) => [st, 8 + i * 2])) })
}

function edition(measure: string) {
  const spec = whitePlacesSpecs().find((s) => s.measure === measure && s.scope.kind === 'national')!
  return rankWhitePlaces(spec, sample(), () => '/places', '2026-11', '2026-11-16T00:00:00Z', null)!
}

export const BestPlacesAll = () => <RankingView e={edition('wp_all')} index={[]} latest />
export const BestPlacesCriterion = () => <RankingView e={edition('wp_house')} index={[]} latest />
